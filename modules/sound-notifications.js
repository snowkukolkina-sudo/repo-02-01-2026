/**
 * DANDY Sound Notifications Module
 * Звуковые уведомления для новых заказов
 * ВЕРСИЯ 13: Socket.IO отключен
 */

class SoundNotificationsModule {
    constructor() {
        this.sounds = {
            newOrder: null,
            aggregatorOrder: null,
            urgentOrder: null
        };
        this.isEnabled = true;
        this.volume = 0.7;
        this.lastNotificationTime = 0;
        this.notificationCooldown = 3000; // 3 seconds
        this.socket = null;
        this.pollingInterval = null;
    }

    async init() {
        console.log('🔔 Sound Notifications Module initialized');
        await this.loadSounds();
        this.setupPermissions();
        await this.startMonitoring();
    }

    async loadSounds() {
        const forceRemote = window.SOUND_NOTIFICATIONS_FORCE_REMOTE === true;
        const preferRemote = window.SOUND_NOTIFICATIONS_PREFER_REMOTE === true;

        if (!forceRemote && !preferRemote) {
            this.setupFallbackSounds(true);
            return;
        }

        try {
            const soundFiles = window.SOUND_NOTIFICATIONS_REMOTE_SOURCES || {
                newOrder: '/assets/sounds/new-order.mp3',
                aggregatorOrder: '/assets/sounds/aggregator-order.mp3',
                urgentOrder: '/assets/sounds/urgent-order.mp3'
            };

            const fileChecks = await Promise.all(Object.entries(soundFiles).map(async ([key, url]) => {
                try {
                    const response = await fetch(url, { method: 'HEAD', cache: 'no-store' });
                    // Проверяем, что статус действительно 200-299, а не просто ok
                    if (response.ok && response.status >= 200 && response.status < 300) {
                        return { key, url };
                    }
                    return null;
                } catch (e) {
                    // Игнорируем ошибки сети - файл недоступен
                    return null;
                }
            }));

            const available = fileChecks.filter(Boolean);

            if (available.length === 3) {
                // Создаем Audio объекты с обработкой ошибок
                const createAudioWithErrorHandling = (url) => {
                    const audio = new Audio();
                    audio.volume = this.volume;
                    
                    // Добавляем обработчик ошибок загрузки
                    audio.addEventListener('error', (e) => {
                        console.warn(`⚠️ Не удалось загрузить звуковой файл: ${url}`);
                        // Не показываем ошибку в консоли, просто игнорируем
                        return false;
                    });
                    
                    // Предзагрузка с обработкой ошибок
                    audio.addEventListener('canplaythrough', () => {
                        // Файл успешно загружен
                    }, { once: true });
                    
                    audio.src = url;
                    // Предзагружаем файл, но не воспроизводим
                    audio.load();
                    
                    return audio;
                };

                try {
                    this.sounds.newOrder = createAudioWithErrorHandling(soundFiles.newOrder);
                    this.sounds.aggregatorOrder = createAudioWithErrorHandling(soundFiles.aggregatorOrder);
                    this.sounds.urgentOrder = createAudioWithErrorHandling(soundFiles.urgentOrder);

                    // Проверяем, что все файлы действительно загрузились
                    // Если нет - переключаемся на fallback
                    const checkAudioLoaded = (audio, name) => {
                        return new Promise((resolve) => {
                            const timeout = setTimeout(() => {
                                resolve(false); // Таймаут - файл не загрузился
                            }, 2000);
                            
                            audio.addEventListener('canplaythrough', () => {
                                clearTimeout(timeout);
                                resolve(true);
                            }, { once: true });
                            
                            audio.addEventListener('error', () => {
                                clearTimeout(timeout);
                                resolve(false);
                            }, { once: true });
                        });
                    };

                    // Проверяем загрузку всех файлов
                    const loadChecks = await Promise.all([
                        checkAudioLoaded(this.sounds.newOrder, 'newOrder'),
                        checkAudioLoaded(this.sounds.aggregatorOrder, 'aggregatorOrder'),
                        checkAudioLoaded(this.sounds.urgentOrder, 'urgentOrder')
                    ]);

                    if (loadChecks.every(loaded => loaded)) {
                        console.log('✅ Sounds loaded from files');
                        return;
                    } else {
                        // Не все файлы загрузились - используем fallback
                        console.info('ℹ️ Некоторые звуковые файлы недоступны, используем встроенные сигналы');
                        this.sounds.newOrder = null;
                        this.sounds.aggregatorOrder = null;
                        this.sounds.urgentOrder = null;
                        this.setupFallbackSounds(true);
                        return;
                    }
                } catch (error) {
                    console.info('ℹ️ Ошибка загрузки звуковых файлов, используем встроенные сигналы');
                    this.sounds.newOrder = null;
                    this.sounds.aggregatorOrder = null;
                    this.sounds.urgentOrder = null;
                    this.setupFallbackSounds(true);
                    return;
                }
            }

            if (forceRemote) {
                throw new Error('Sound files forced but not available');
            }

            console.info('ℹ️ Remote sound files unavailable, switching to inline tones');
            this.setupFallbackSounds(true);
            return;
        } catch (error) {
            console.info('ℹ️ Используем встроенные сигналы вместо mp3 (файлы не найдены)');
            this.setupFallbackSounds(true);
        }
    }

    setupFallbackSounds(logCreated = false) {
        // Create beep sounds using Web Audio API
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();

        const createBeep = (frequency, duration) => {
            return {
                play: () => {
                    const oscillator = audioContext.createOscillator();
                    const gainNode = audioContext.createGain();
                    
                    oscillator.connect(gainNode);
                    gainNode.connect(audioContext.destination);
                    
                    oscillator.frequency.value = frequency;
                    oscillator.type = 'sine';
                    
                    gainNode.gain.setValueAtTime(this.volume, audioContext.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
                    
                    oscillator.start(audioContext.currentTime);
                    oscillator.stop(audioContext.currentTime + duration);
                }
            };
        };

        this.sounds.newOrder = createBeep(800, 0.2);
        this.sounds.aggregatorOrder = createBeep(1000, 0.3);
        this.sounds.urgentOrder = createBeep(1200, 0.4);

        if (logCreated) {
            console.log('✅ Fallback beep sounds активированы (mp3 отключены)');
        }
    }

    setupPermissions() {
        // Request notification permission if not already granted
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission().then(permission => {
                console.log('Notification permission:', permission);
            });
        }
    }

    async startMonitoring() {
        // Полностью отключаем любые сетевые запросы для мониторинга заказов
        console.info('ℹ️ Мониторинг новых заказов отключен (нет запросов к /api/orders)');
        this.pollingInterval = null;
    }

    async checkSocketAvailability() {
        // Socket.IO не настроен на сервере, всегда возвращаем false без попыток подключения
        return false;
    }

    async checkForNewOrders() {
        // Функция-заглушка — никакие HTTP-запросы больше не выполняются
        return;
    }

    handleNewOrder(order) {
        console.log('🔔 New order received:', order);

        // Check cooldown
        const now = Date.now();
        if (now - this.lastNotificationTime < this.notificationCooldown) {
            return;
        }
        this.lastNotificationTime = now;

        // Play sound
        if (this.isEnabled) {
            this.playSound('newOrder');
        }

        // Show browser notification
        this.showNotification('🍕 Новый заказ!', `Заказ #${order.order_number || String(order.id).slice(0, 8)} на сумму ₽${order.total_amount}`);

        // Flash tab title
        this.flashTabTitle('🔴 НОВЫЙ ЗАКАЗ!');

        // Show toast notification in UI
        this.showToast('🍕 Новый заказ!', `Заказ #${order.order_number || String(order.id).slice(0, 8)}`, 'info');
    }

    handleAggregatorOrder(order) {
        console.log('🟡 Aggregator order received:', order);

        const now = Date.now();
        if (now - this.lastNotificationTime < this.notificationCooldown) {
            return;
        }
        this.lastNotificationTime = now;

        // Play different sound for aggregator orders
        if (this.isEnabled) {
            this.playSound('aggregatorOrder');
        }

        const sourceName = {
            'yandex_eda': 'Яндекс.Еда',
            'vkusvill': 'ВкусВилл',
            'delivery_club': 'Delivery Club'
        }[order.source] || 'Агрегатор';

        this.showNotification(`🟡 ${sourceName}`, `Заказ #${order.order_number || order.id.slice(0, 8)} на сумму ₽${order.total_amount}`);
        this.flashTabTitle(`🟡 ${sourceName}!`);
        this.showToast(`🟡 ${sourceName}`, `Заказ #${order.order_number || order.id.slice(0, 8)}`, 'warning');
    }

    handleUrgentOrder(order) {
        console.log('🔴 Urgent order received:', order);

        // Always play urgent sound, even during cooldown
        if (this.isEnabled) {
            this.playSound('urgentOrder');
        }

        this.showNotification('🔴 СРОЧНЫЙ ЗАКАЗ!', `Заказ #${order.order_number || String(order.id).slice(0, 8)} - ТРЕБУЕТ ВНИМАНИЯ!`);
        this.flashTabTitle('🔴 СРОЧНО!');
        this.showToast('🔴 СРОЧНЫЙ ЗАКАЗ!', `Заказ #${order.order_number || String(order.id).slice(0, 8)}`, 'error');
    }

    playSound(soundType) {
        if (!this.isEnabled) return;

        const sound = this.sounds[soundType];
        if (!sound) {
            // Звук не загружен - ничего не делаем
            return;
        }

        // Проверяем, это Audio объект или fallback beep
        if (sound instanceof HTMLAudioElement) {
            // Это Audio объект - проверяем, что он загружен
            if (sound.readyState >= 2) { // HAVE_CURRENT_DATA или выше
                try {
                    // Сбрасываем позицию на начало для повторного воспроизведения
                    sound.currentTime = 0;
                    const playPromise = sound.play();
                    if (playPromise && typeof playPromise.catch === 'function') {
                        playPromise.catch(error => {
                            // Игнорируем ошибки воспроизведения (файл может быть недоступен)
                            // Не логируем, чтобы не засорять консоль
                        });
                    }
                } catch (error) {
                    // Игнорируем ошибки воспроизведения
                }
            } else {
                // Audio объект еще не загружен или произошла ошибка - используем fallback
                this.setupFallbackSounds(false);
                const fallbackSound = this.sounds[soundType];
                if (fallbackSound && typeof fallbackSound.play === 'function') {
                    try {
                        fallbackSound.play();
                    } catch (e) {
                        // Игнорируем ошибки
                    }
                }
            }
        } else if (sound && typeof sound.play === 'function') {
            // Это fallback beep - просто воспроизводим
            try {
                sound.play();
            } catch (e) {
                // Игнорируем ошибки
            }
        }
    }

    showNotification(title, body) {
        if ('Notification' in window && Notification.permission === 'granted') {
            const notification = new Notification(title, {
                body,
                icon: '/assets/dandy_logo_eng.png',
                badge: '/assets/dandy_logo_eng.png',
                tag: 'order-notification',
                requireInteraction: true
            });

            notification.onclick = () => {
                window.focus();
                notification.close();
            };

            // Auto close after 10 seconds
            setTimeout(() => notification.close(), 10000);
        }
    }

    flashTabTitle(text) {
        const originalTitle = document.title;
        let flashing = true;
        let count = 0;

        const interval = setInterval(() => {
            document.title = flashing ? text : originalTitle;
            flashing = !flashing;
            count++;

            if (count >= 10) { // Flash 5 times (10 intervals)
                clearInterval(interval);
                document.title = originalTitle;
            }
        }, 500);

        // Stop flashing when user focuses window
        window.addEventListener('focus', () => {
            clearInterval(interval);
            document.title = originalTitle;
        }, { once: true });
    }

    showToast(title, message, type = 'info') {
        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            min-width: 300px;
            background: ${type === 'error' ? '#dc3545' : type === 'warning' ? '#ffc107' : '#28a745'};
            color: white;
            padding: 1rem;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            animation: slideIn 0.3s ease-out;
        `;

        toast.innerHTML = `
            <h4 style="margin: 0 0 0.5rem 0;">${title}</h4>
            <p style="margin: 0;">${message}</p>
        `;

        document.body.appendChild(toast);

        // Auto remove after 5 seconds
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => toast.remove(), 300);
        }, 5000);

        // Click to dismiss
        toast.addEventListener('click', () => {
            toast.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => toast.remove(), 300);
        });
    }

    toggle() {
        this.isEnabled = !this.isEnabled;
        console.log(`🔔 Sound notifications ${this.isEnabled ? 'enabled' : 'disabled'}`);
        return this.isEnabled;
    }

    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        Object.values(this.sounds).forEach(sound => {
            if (sound) {
                sound.volume = this.volume;
            }
        });
        console.log(`🔊 Volume set to ${Math.round(this.volume * 100)}%`);
    }

    testSound(soundType = 'newOrder') {
        console.log(`🔊 Testing sound: ${soundType}`);
        this.playSound(soundType);
    }

    destroy() {
        // Отключаем WebSocket соединение
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }

        // Останавливаем polling
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }

        console.log('🔔 Sound Notifications Module destroyed');
    }
}

// CSS animations
if (!document.getElementById('sound-notifications-styles')) {
    const styleElement = document.createElement('style');
    styleElement.id = 'sound-notifications-styles';
    styleElement.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(400px);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }

        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(400px);
                opacity: 0;
            }
        }

        .toast {
            cursor: pointer;
            transition: transform 0.2s;
        }

        .toast:hover {
            transform: scale(1.02);
        }
    `;
    document.head.appendChild(styleElement);
}

// Initialize module
if (typeof window !== 'undefined') {
    window.SoundNotificationsModule = SoundNotificationsModule;
    window.soundNotifications = new SoundNotificationsModule();
    
    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.soundNotifications.init();
        });
    } else {
        window.soundNotifications.init();
    }
}

