/**
 * МОДУЛЬ БЕЗОПАСНОСТИ: 2FA
 * Двухфакторная аутентификация
 */

class Security2FA {
    constructor() {
        this.config = {
            codeLength: 6,
            codeExpiry: 300, // 5 минут в секундах
            smsProvider: 'smsc', // 'smsc' | 'twilio' | 'sms-aero'
            emailProvider: 'smtp'
        };
        
        this.pendingCodes = new Map();
        this.init();
    }

    init() {
        console.log('🔐 Модуль 2FA инициализирован');
    }

    // ===== ГЕНЕРАЦИЯ КОДОВ =====
    
    generateCode() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    async sendCode(phone, method = 'sms') {
        const code = this.generateCode();
        const expiresAt = Date.now() + (this.config.codeExpiry * 1000);

        this.pendingCodes.set(phone, {
            code,
            expiresAt,
            attempts: 0
        });

        if (method === 'sms') {
            await this.sendSMS(phone, code);
        } else if (method === 'email') {
            await this.sendEmail(phone, code);
        }

        console.log(`📱 Код отправлен на ${phone}: ${code}`);
        return true;
    }

    async sendSMS(phone, code) {
        const message = `Ваш код подтверждения ДЭНДИ: ${code}\nКод действителен 5 минут.`;

        try {
            // SMSC.ru API
            const response = await fetch(`https://smsc.ru/sys/send.php?login=YOUR_LOGIN&psw=YOUR_PASSWORD&phones=${encodeURIComponent(phone)}&mes=${encodeURIComponent(message)}&charset=utf-8`);
            
            if (response.ok) {
                console.log('✅ SMS отправлена');
                return true;
            }
        } catch (error) {
            console.error('❌ Ошибка отправки SMS:', error);
        }

        return false;
    }

    async sendEmail(email, code) {
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #10b981;">🔐 Код подтверждения ДЭНДИ</h2>
                <p>Ваш код для входа:</p>
                <div style="background: #f3f4f6; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; border-radius: 8px;">
                    ${code}
                </div>
                <p style="color: #666; font-size: 14px;">Код действителен 5 минут.</p>
                <p style="color: #666; font-size: 12px;">Если вы не запрашивали этот код, проигнорируйте это письмо.</p>
            </div>
        `;

        try {
            await fetch('/api/send-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: email,
                    subject: 'Код подтверждения ДЭНДИ',
                    html
                })
            });
            
            console.log('✅ Email отправлен');
            return true;
        } catch (error) {
            console.error('❌ Ошибка отправки email:', error);
            return false;
        }
    }

    // ===== ПРОВЕРКА КОДОВ =====
    
    verifyCode(phone, code) {
        const pending = this.pendingCodes.get(phone);
        
        if (!pending) {
            return { success: false, error: 'Код не найден' };
        }

        if (Date.now() > pending.expiresAt) {
            this.pendingCodes.delete(phone);
            return { success: false, error: 'Код истёк' };
        }

        if (pending.attempts >= 3) {
            this.pendingCodes.delete(phone);
            return { success: false, error: 'Превышено количество попыток' };
        }

        if (pending.code === code) {
            this.pendingCodes.delete(phone);
            return { success: true };
        }

        pending.attempts++;
        return { success: false, error: 'Неверный код' };
    }

    // ===== ИНТЕРФЕЙС =====
    
    show2FAModal(phone, onSuccess) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 400px;">
                <h2>🔐 Двухфакторная аутентификация</h2>
                <p>Введите код, отправленный на номер:</p>
                <p style="font-weight: bold; font-size: 18px;">${phone}</p>

                <div style="margin: 20px 0;">
                    <input type="text" 
                           id="2faCode" 
                           maxlength="6" 
                           placeholder="000000"
                           style="width: 100%; padding: 15px; font-size: 24px; text-align: center; letter-spacing: 5px; border: 2px solid #e5e7eb; border-radius: 8px;"
                           autofocus>
                </div>

                <div id="2faError" style="color: #ef4444; margin-bottom: 10px; display: none;"></div>

                <div style="display: flex; gap: 10px;">
                    <button class="btn btn-primary" onclick="security2FA.verify2FA('${phone}', this)">
                        Подтвердить
                    </button>
                    <button class="btn" onclick="security2FA.resendCode('${phone}')">
                        Отправить снова
                    </button>
                    <button class="btn" onclick="this.closest('.modal-overlay').remove()">
                        Отмена
                    </button>
                </div>

                <p style="font-size: 12px; color: #666; margin-top: 15px;">
                    Код действителен 5 минут
                </p>
            </div>
        `;

        document.body.appendChild(modal);

        // Автоматическая проверка при вводе 6 цифр
        const input = modal.querySelector('#2faCode');
        input.addEventListener('input', (e) => {
            if (e.target.value.length === 6) {
                this.verify2FA(phone, modal.querySelector('.btn-primary'));
            }
        });

        // Сохраняем callback
        modal.dataset.onSuccess = onSuccess;
    }

    async verify2FA(phone, button) {
        const modal = button.closest('.modal-overlay');
        const input = modal.querySelector('#2faCode');
        const error = modal.querySelector('#2faError');
        const code = input.value;

        const result = this.verifyCode(phone, code);

        if (result.success) {
            error.style.display = 'none';
            
            // Успех!
            const successDiv = document.createElement('div');
            successDiv.innerHTML = `
                <div style="text-align: center; padding: 20px;">
                    <div style="font-size: 64px;">✅</div>
                    <h3>Успешно!</h3>
                </div>
            `;
            modal.querySelector('.modal-content').innerHTML = successDiv.innerHTML;

            setTimeout(() => {
                modal.remove();
                if (modal.dataset.onSuccess) {
                    eval(modal.dataset.onSuccess)();
                }
            }, 1000);
        } else {
            error.textContent = result.error;
            error.style.display = 'block';
            input.value = '';
            input.focus();
        }
    }

    async resendCode(phone) {
        await this.sendCode(phone);
        alert('✅ Код отправлен повторно');
    }
}

// Экспорт
window.Security2FA = Security2FA;
window.security2FA = new Security2FA();
