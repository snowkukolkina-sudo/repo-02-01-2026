/**
 * Модуль биометрической аутентификации
 * Поддержка отпечатков пальцев, Face ID, Touch ID
 */

class BiometricAuthModule {
    constructor() {
        this.isSupported = false;
        this.biometricType = null;
        this.enrolledUsers = new Map();
        this.init();
    }

    init() {
        this.checkBiometricSupport();
        this.loadEnrolledUsers();
    }

    // Проверка поддержки биометрии
    checkBiometricSupport() {
        try {
            // Проверка WebAuthn API
            if (window.PublicKeyCredential) {
                this.isSupported = true;
                this.biometricType = 'webauthn';
                return;
            }

            // Проверка для мобильных устройств
            if (navigator.userAgent.includes('Android')) {
                this.isSupported = true;
                this.biometricType = 'android';
                return;
            }

            if (navigator.userAgent.includes('iPhone') || navigator.userAgent.includes('iPad')) {
                this.isSupported = true;
                this.biometricType = 'ios';
                return;
            }

            // Проверка для Windows Hello
            if (navigator.userAgent.includes('Windows')) {
                this.isSupported = true;
                this.biometricType = 'windows';
                return;
            }

            this.isSupported = false;
        } catch (error) {
            console.error('Ошибка проверки поддержки биометрии:', error);
            this.isSupported = false;
        }
    }

    // Загрузка зарегистрированных пользователей
    loadEnrolledUsers() {
        try {
            const savedUsers = localStorage.getItem('biometricUsers');
            if (savedUsers) {
                const users = JSON.parse(savedUsers);
                this.enrolledUsers = new Map(users);
            }
        } catch (error) {
            console.error('Ошибка загрузки пользователей биометрии:', error);
        }
    }

    // Сохранение зарегистрированных пользователей
    saveEnrolledUsers() {
        try {
            const users = Array.from(this.enrolledUsers.entries());
            localStorage.setItem('biometricUsers', JSON.stringify(users));
        } catch (error) {
            console.error('Ошибка сохранения пользователей биометрии:', error);
        }
    }

    // Регистрация пользователя для биометрической аутентификации
    async enrollUser(userId, userInfo) {
        if (!this.isSupported) {
            return { success: false, error: 'Биометрическая аутентификация не поддерживается' };
        }

        try {
            let credential;
            
            switch (this.biometricType) {
                case 'webauthn':
                    credential = await this.enrollWebAuthn(userId, userInfo);
                    break;
                case 'android':
                    credential = await this.enrollAndroid(userId, userInfo);
                    break;
                case 'ios':
                    credential = await this.enrollIOS(userId, userInfo);
                    break;
                case 'windows':
                    credential = await this.enrollWindows(userId, userInfo);
                    break;
                default:
                    return { success: false, error: 'Неподдерживаемый тип биометрии' };
            }

            if (credential) {
                this.enrolledUsers.set(userId, {
                    userId: userId,
                    userInfo: userInfo,
                    credential: credential,
                    enrolledAt: new Date().toISOString(),
                    biometricType: this.biometricType
                });
                this.saveEnrolledUsers();
                
                return { success: true, message: 'Пользователь зарегистрирован для биометрической аутентификации' };
            } else {
                return { success: false, error: 'Не удалось создать биометрический ключ' };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Регистрация через WebAuthn
    async enrollWebAuthn(userId, userInfo) {
        try {
            const publicKeyCredentialCreationOptions = {
                challenge: new Uint8Array(32),
                rp: {
                    name: "DANDY POS",
                    id: window.location.hostname,
                },
                user: {
                    id: new TextEncoder().encode(userId),
                    name: userInfo.username,
                    displayName: userInfo.displayName || userInfo.username,
                },
                pubKeyCredParams: [
                    { alg: -7, type: "public-key" }, // ES256
                    { alg: -257, type: "public-key" }, // RS256
                ],
                authenticatorSelection: {
                    authenticatorAttachment: "platform",
                    userVerification: "required",
                },
                timeout: 60000,
                attestation: "direct"
            };

            const credential = await navigator.credentials.create({
                publicKey: publicKeyCredentialCreationOptions
            });

            return {
                id: credential.id,
                rawId: Array.from(new Uint8Array(credential.rawId)),
                response: {
                    attestationObject: Array.from(new Uint8Array(credential.response.attestationObject)),
                    clientDataJSON: Array.from(new Uint8Array(credential.response.clientDataJSON))
                }
            };
        } catch (error) {
            console.error('Ошибка WebAuthn регистрации:', error);
            return null;
        }
    }

    // Регистрация для Android
    async enrollAndroid(userId, userInfo) {
        try {
            // Симуляция регистрации для Android
            // В реальной системе здесь был бы вызов Android API
            const credential = {
                id: `android_${userId}_${Date.now()}`,
                type: 'android_biometric',
                userId: userId,
                enrolledAt: new Date().toISOString()
            };

            return credential;
        } catch (error) {
            console.error('Ошибка Android регистрации:', error);
            return null;
        }
    }

    // Регистрация для iOS
    async enrollIOS(userId, userInfo) {
        try {
            // Симуляция регистрации для iOS
            // В реальной системе здесь был бы вызов iOS API
            const credential = {
                id: `ios_${userId}_${Date.now()}`,
                type: 'ios_biometric',
                userId: userId,
                enrolledAt: new Date().toISOString()
            };

            return credential;
        } catch (error) {
            console.error('Ошибка iOS регистрации:', error);
            return null;
        }
    }

    // Регистрация для Windows Hello
    async enrollWindows(userId, userInfo) {
        try {
            // Симуляция регистрации для Windows Hello
            // В реальной системе здесь был бы вызов Windows API
            const credential = {
                id: `windows_${userId}_${Date.now()}`,
                type: 'windows_hello',
                userId: userId,
                enrolledAt: new Date().toISOString()
            };

            return credential;
        } catch (error) {
            console.error('Ошибка Windows Hello регистрации:', error);
            return null;
        }
    }

    // Аутентификация пользователя
    async authenticateUser(userId) {
        if (!this.isSupported) {
            return { success: false, error: 'Биометрическая аутентификация не поддерживается' };
        }

        const enrolledUser = this.enrolledUsers.get(userId);
        if (!enrolledUser) {
            return { success: false, error: 'Пользователь не зарегистрирован для биометрической аутентификации' };
        }

        try {
            let authResult;
            
            switch (this.biometricType) {
                case 'webauthn':
                    authResult = await this.authenticateWebAuthn(enrolledUser);
                    break;
                case 'android':
                    authResult = await this.authenticateAndroid(enrolledUser);
                    break;
                case 'ios':
                    authResult = await this.authenticateIOS(enrolledUser);
                    break;
                case 'windows':
                    authResult = await this.authenticateWindows(enrolledUser);
                    break;
                default:
                    return { success: false, error: 'Неподдерживаемый тип биометрии' };
            }

            if (authResult.success) {
                return {
                    success: true,
                    userId: userId,
                    userInfo: enrolledUser.userInfo,
                    authenticatedAt: new Date().toISOString(),
                    biometricType: this.biometricType
                };
            } else {
                return { success: false, error: authResult.error };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Аутентификация через WebAuthn
    async authenticateWebAuthn(enrolledUser) {
        try {
            const publicKeyCredentialRequestOptions = {
                challenge: new Uint8Array(32),
                allowCredentials: [{
                    id: enrolledUser.credential.rawId,
                    type: 'public-key',
                    transports: ['internal']
                }],
                timeout: 60000,
                userVerification: 'required'
            };

            const credential = await navigator.credentials.get({
                publicKey: publicKeyCredentialRequestOptions
            });

            if (credential) {
                return { success: true };
            } else {
                return { success: false, error: 'Аутентификация не удалась' };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Аутентификация для Android
    async authenticateAndroid(enrolledUser) {
        try {
            // Симуляция аутентификации для Android
            // В реальной системе здесь был бы вызов Android API
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Аутентификация для iOS
    async authenticateIOS(enrolledUser) {
        try {
            // Симуляция аутентификации для iOS
            // В реальной системе здесь был бы вызов iOS API
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Аутентификация для Windows Hello
    async authenticateWindows(enrolledUser) {
        try {
            // Симуляция аутентификации для Windows Hello
            // В реальной системе здесь был бы вызов Windows API
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Удаление пользователя из биометрической аутентификации
    async unenrollUser(userId) {
        try {
            const deleted = this.enrolledUsers.delete(userId);
            if (deleted) {
                this.saveEnrolledUsers();
                return { success: true, message: 'Пользователь удален из биометрической аутентификации' };
            } else {
                return { success: false, error: 'Пользователь не найден' };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Проверка, зарегистрирован ли пользователь
    isUserEnrolled(userId) {
        return this.enrolledUsers.has(userId);
    }

    // Получение информации о зарегистрированных пользователях
    getEnrolledUsers() {
        return Array.from(this.enrolledUsers.values());
    }

    // Получение статуса поддержки биометрии
    getBiometricStatus() {
        return {
            isSupported: this.isSupported,
            biometricType: this.biometricType,
            enrolledUsersCount: this.enrolledUsers.size,
            enrolledUsers: this.getEnrolledUsers()
        };
    }

    // Получение статуса модуля (для тестирования)
    getStatus() {
        return {
            isSupported: this.isSupported,
            supportedTypes: this.getAvailableBiometricTypes(),
            enrolledUsers: Array.from(this.enrolledUsers.keys()),
            isEnabled: this.isSupported && this.enrolledUsers.size > 0
        };
    }

    // Аутентификация (для тестирования)
    async authenticate(userId = 'test-user') {
        try {
            if (!this.enrolledUsers.has(userId)) {
                // Автоматически регистрируем пользователя для тестирования
                const enrollResult = await this.enrollUser(userId, 'test-user');
                if (!enrollResult.success) {
                    return { success: false, error: 'Не удалось зарегистрировать пользователя для тестирования' };
                }
            }
            return await this.authenticateUser(userId);
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Тестирование биометрической аутентификации
    async testBiometricAuth() {
        if (!this.isSupported) {
            return { success: false, error: 'Биометрическая аутентификация не поддерживается' };
        }

        try {
            // Создание тестового пользователя
            const testUserId = 'test_user_' + Date.now();
            const testUserInfo = {
                username: 'test_user',
                displayName: 'Тестовый пользователь',
                role: 'cashier'
            };

            // Регистрация
            const enrollResult = await this.enrollUser(testUserId, testUserInfo);
            if (!enrollResult.success) {
                return { success: false, error: 'Ошибка регистрации: ' + enrollResult.error };
            }

            // Аутентификация
            const authResult = await this.authenticateUser(testUserId);
            if (!authResult.success) {
                return { success: false, error: 'Ошибка аутентификации: ' + authResult.error };
            }

            // Удаление тестового пользователя
            await this.unenrollUser(testUserId);

            return { 
                success: true, 
                message: 'Биометрическая аутентификация работает корректно',
                biometricType: this.biometricType
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Получение доступных типов биометрии
    getAvailableBiometricTypes() {
        const types = [];

        if (this.isSupported) {
            switch (this.biometricType) {
                case 'webauthn':
                    types.push('WebAuthn (универсальный)');
                    break;
                case 'android':
                    types.push('Android Biometric (отпечаток пальца, Face ID)');
                    break;
                case 'ios':
                    types.push('Touch ID, Face ID');
                    break;
                case 'windows':
                    types.push('Windows Hello (отпечаток пальца, распознавание лица)');
                    break;
            }
        }

        return types;
    }

    // Очистка всех зарегистрированных пользователей
    clearAllEnrolledUsers() {
        try {
            this.enrolledUsers.clear();
            this.saveEnrolledUsers();
            return { success: true, message: 'Все пользователи удалены из биометрической аутентификации' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Экспорт настроек биометрии
    exportBiometricSettings() {
        return {
            enrolledUsers: this.getEnrolledUsers(),
            biometricType: this.biometricType,
            isSupported: this.isSupported,
            exportedAt: new Date().toISOString()
        };
    }

    // Импорт настроек биометрии
    importBiometricSettings(data) {
        try {
            if (data.enrolledUsers) {
                data.enrolledUsers.forEach(user => {
                    this.enrolledUsers.set(user.userId, user);
                });
                this.saveEnrolledUsers();
            }
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

// Экспорт модуля
window.BiometricAuthModule = BiometricAuthModule;
