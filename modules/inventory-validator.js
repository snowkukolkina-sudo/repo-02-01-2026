/**
 * DANDY Inventory — Модуль валидации
 * Проверка форм, данных, ИНН, КПП, штрихкодов
 */

class InventoryValidator {
    constructor() {
        this.errors = [];
    }

    /**
     * Очистка ошибок
     */
    clearErrors() {
        this.errors = [];
    }

    /**
     * Добавление ошибки
     */
    addError(field, message) {
        this.errors.push({ field, message });
    }

    /**
     * Получение ошибок
     */
    getErrors() {
        return this.errors;
    }

    /**
     * Есть ли ошибки
     */
    hasErrors() {
        return this.errors.length > 0;
    }

    /**
     * Показ ошибок в модальном окне
     */
    showErrors() {
        if (!this.hasErrors()) return;

        const errorMessages = this.errors.map(err => 
            `<div style="margin-bottom: 0.5rem;">
                <strong>${err.field}:</strong> ${err.message}
            </div>`
        ).join('');

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div style="background: #094a45; color: #F3EADB; border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; padding: 2rem; max-width: 500px; width: 90%;">
                <h2 style="margin: 0 0 1.5rem 0; color: #ef4444;">⚠️ Ошибки валидации</h2>
                <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem;">
                    ${errorMessages}
                </div>
                <button onclick="this.closest('.modal-overlay').remove()" class="btn btn-primary">
                    Закрыть
                </button>
            </div>
        `;
        document.body.appendChild(modal);
    }

    /**
     * Валидация обязательного поля
     */
    validateRequired(value, fieldName) {
        if (!value || value.toString().trim() === '') {
            this.addError(fieldName, 'Поле обязательно для заполнения');
            return false;
        }
        return true;
    }

    /**
     * Валидация числового значения
     */
    validateNumber(value, fieldName, options = {}) {
        const num = parseFloat(value);
        
        if (isNaN(num)) {
            this.addError(fieldName, 'Должно быть числом');
            return false;
        }

        if (options.min !== undefined && num < options.min) {
            this.addError(fieldName, `Минимальное значение: ${options.min}`);
            return false;
        }

        if (options.max !== undefined && num > options.max) {
            this.addError(fieldName, `Максимальное значение: ${options.max}`);
            return false;
        }

        if (options.positive && num <= 0) {
            this.addError(fieldName, 'Должно быть положительным числом');
            return false;
        }

        return true;
    }

    /**
     * Валидация цены
     */
    validatePrice(value, fieldName) {
        return this.validateNumber(value, fieldName, { min: 0, positive: false });
    }

    /**
     * Валидация количества
     */
    validateQuantity(value, fieldName) {
        return this.validateNumber(value, fieldName, { min: 0.001, positive: true });
    }

    /**
     * Валидация ИНН (10 или 12 цифр)
     */
    validateINN(inn, fieldName = 'ИНН') {
        if (!inn) {
            this.addError(fieldName, 'ИНН не может быть пустым');
            return false;
        }

        inn = inn.toString().replace(/\s/g, '');

        if (!/^\d{10}$|^\d{12}$/.test(inn)) {
            this.addError(fieldName, 'ИНН должен содержать 10 или 12 цифр');
            return false;
        }

        // Проверка контрольной суммы для ИНН
        const checkDigit = (inn, coefficients) => {
            let n = 0;
            for (let i in coefficients) {
                n += coefficients[i] * inn[i];
            }
            return parseInt(n % 11 % 10);
        };

        if (inn.length === 10) {
            const n10 = checkDigit(inn, [2, 4, 10, 3, 5, 9, 4, 6, 8]);
            if (n10 !== parseInt(inn[9])) {
                this.addError(fieldName, 'Неверная контрольная сумма ИНН');
                return false;
            }
        } else if (inn.length === 12) {
            const n11 = checkDigit(inn, [7, 2, 4, 10, 3, 5, 9, 4, 6, 8]);
            const n12 = checkDigit(inn, [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8]);
            if (n11 !== parseInt(inn[10]) || n12 !== parseInt(inn[11])) {
                this.addError(fieldName, 'Неверная контрольная сумма ИНН');
                return false;
            }
        }

        return true;
    }

    /**
     * Валидация КПП (9 цифр)
     */
    validateKPP(kpp, fieldName = 'КПП') {
        if (!kpp) {
            this.addError(fieldName, 'КПП не может быть пустым');
            return false;
        }

        kpp = kpp.toString().replace(/\s/g, '');

        if (!/^\d{9}$/.test(kpp)) {
            this.addError(fieldName, 'КПП должен содержать 9 цифр');
            return false;
        }

        return true;
    }

    /**
     * Валидация ОГРН (13 или 15 цифр)
     */
    validateOGRN(ogrn, fieldName = 'ОГРН') {
        if (!ogrn) {
            this.addError(fieldName, 'ОГРН не может быть пустым');
            return false;
        }

        ogrn = ogrn.toString().replace(/\s/g, '');

        if (!/^\d{13}$|^\d{15}$/.test(ogrn)) {
            this.addError(fieldName, 'ОГРН должен содержать 13 или 15 цифр');
            return false;
        }

        // Проверка контрольного числа
        const length = ogrn.length;
        const mainPart = ogrn.substring(0, length - 1);
        const checkDigit = parseInt(ogrn.substring(length - 1));
        const calculatedCheck = parseInt(mainPart) % (length === 13 ? 11 : 13) % 10;

        if (checkDigit !== calculatedCheck) {
            this.addError(fieldName, 'Неверная контрольная сумма ОГРН');
            return false;
        }

        return true;
    }

    /**
     * Валидация штрихкода (EAN-8, EAN-13, или произвольный)
     */
    validateBarcode(barcode, fieldName = 'Штрихкод') {
        if (!barcode) {
            return true; // Штрихкод необязателен
        }

        barcode = barcode.toString().replace(/\s/g, '');

        // EAN-8 или EAN-13
        if (/^\d{8}$/.test(barcode) || /^\d{13}$/.test(barcode)) {
            const digits = barcode.split('').map(Number);
            const checkDigit = digits.pop();
            
            let sum = 0;
            digits.forEach((digit, index) => {
                sum += digit * (index % 2 === 0 ? 1 : 3);
            });
            
            const calculatedCheck = (10 - (sum % 10)) % 10;
            
            if (checkDigit !== calculatedCheck) {
                this.addError(fieldName, 'Неверная контрольная сумма штрихкода');
                return false;
            }
        }

        return true;
    }

    /**
     * Валидация email
     */
    validateEmail(email, fieldName = 'Email') {
        if (!email) {
            this.addError(fieldName, 'Email не может быть пустым');
            return false;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            this.addError(fieldName, 'Некорректный email адрес');
            return false;
        }

        return true;
    }

    /**
     * Валидация телефона
     */
    validatePhone(phone, fieldName = 'Телефон') {
        if (!phone) {
            return true; // Телефон необязателен
        }

        const phoneRegex = /^(\+7|8)?[\s\-]?\(?[0-9]{3}\)?[\s\-]?[0-9]{3}[\s\-]?[0-9]{2}[\s\-]?[0-9]{2}$/;
        if (!phoneRegex.test(phone)) {
            this.addError(fieldName, 'Некорректный номер телефона (ожидается формат +7XXXXXXXXXX)');
            return false;
        }

        return true;
    }

    /**
     * Валидация даты
     */
    validateDate(date, fieldName = 'Дата') {
        if (!date) {
            this.addError(fieldName, 'Дата не может быть пустой');
            return false;
        }

        const dateObj = new Date(date);
        if (isNaN(dateObj.getTime())) {
            this.addError(fieldName, 'Некорректная дата');
            return false;
        }

        return true;
    }

    /**
     * Валидация срока годности (должен быть > даты прихода)
     */
    validateExpiryDate(expiryDate, arrivalDate, expiryFieldName = 'Срок годности', arrivalFieldName = 'Дата прихода') {
        if (!this.validateDate(expiryDate, expiryFieldName)) return false;
        if (!this.validateDate(arrivalDate, arrivalFieldName)) return false;

        const expiry = new Date(expiryDate);
        const arrival = new Date(arrivalDate);

        if (expiry <= arrival) {
            this.addError(expiryFieldName, 'Срок годности должен быть позже даты прихода');
            return false;
        }

        return true;
    }

    /**
     * Валидация товара (полная)
     */
    validateProduct(product) {
        this.clearErrors();

        // Обязательные поля
        this.validateRequired(product.name, 'Наименование');
        this.validateRequired(product.code, 'Код товара');
        this.validateRequired(product.type, 'Тип товара');
        this.validateRequired(product.baseUnit, 'Единица измерения');

        // Числовые значения
        if (product.price !== undefined) {
            this.validatePrice(product.price, 'Цена');
        }

        if (product.minStock !== undefined) {
            this.validateQuantity(product.minStock, 'Минимальный остаток');
        }

        // Штрихкод
        if (product.barcode) {
            this.validateBarcode(product.barcode);
        }

        // Для алкоголя
        if (product.isAlcohol && product.alcoholStrength !== undefined) {
            this.validateNumber(product.alcoholStrength, 'Крепость', { min: 0, max: 100 });
        }

        return !this.hasErrors();
    }

    /**
     * Валидация документа прихода
     */
    validateArrivalDocument(doc) {
        this.clearErrors();

        this.validateRequired(doc.number, 'Номер документа');
        this.validateRequired(doc.supplier, 'Поставщик');
        this.validateRequired(doc.warehouse, 'Склад');
        this.validateDate(doc.date, 'Дата документа');

        if (!doc.items || doc.items.length === 0) {
            this.addError('Товары', 'Добавьте хотя бы один товар');
        } else {
            doc.items.forEach((item, index) => {
                this.validateRequired(item.productId, `Товар #${index + 1}`);
                this.validateQuantity(item.quantity, `Количество #${index + 1}`);
                this.validatePrice(item.price, `Цена #${index + 1}`);

                if (item.expiryDate) {
                    this.validateExpiryDate(item.expiryDate, doc.date, `Срок годности #${index + 1}`);
                }
            });
        }

        return !this.hasErrors();
    }

    /**
     * Валидация техкарты
     */
    validateRecipe(recipe) {
        this.clearErrors();

        this.validateRequired(recipe.code, 'Код ТК');
        this.validateRequired(recipe.dishName, 'Наименование блюда');
        this.validateQuantity(recipe.yieldOut, 'Выход');
        this.validateRequired(recipe.yieldUnit, 'Единица выхода');

        if (!recipe.ingredients || recipe.ingredients.length === 0) {
            this.addError('Состав', 'Добавьте хотя бы один ингредиент');
        } else {
            recipe.ingredients.forEach((ing, index) => {
                this.validateRequired(ing.id, `Ингредиент #${index + 1}`);
                this.validateQuantity(ing.qty, `Количество #${index + 1}`);
                
                if (ing.k_evap !== undefined) {
                    this.validateNumber(ing.k_evap, `Потери % #${index + 1}`, { min: 0, max: 100 });
                }
            });
        }

        return !this.hasErrors();
    }

    /**
     * Валидация настроек организации
     */
    validateOrganization(org) {
        this.clearErrors();

        this.validateRequired(org.name, 'Наименование организации');
        this.validateINN(org.inn);
        this.validateKPP(org.kpp);
        
        if (org.ogrn) {
            this.validateOGRN(org.ogrn);
        }

        if (org.email) {
            this.validateEmail(org.email);
        }

        if (org.phone) {
            this.validatePhone(org.phone);
        }

        return !this.hasErrors();
    }

    /**
     * Визуальная подсветка ошибок в форме
     */
    highlightErrors(formElement) {
        // Убираем предыдущие подсветки
        formElement.querySelectorAll('.input-error').forEach(el => {
            el.classList.remove('input-error');
        });

        // Добавляем новые
        this.errors.forEach(error => {
            const input = formElement.querySelector(`[name="${error.field}"], #${error.field}`);
            if (input) {
                input.classList.add('input-error');
                input.style.borderColor = '#ef4444';
                input.style.backgroundColor = 'rgba(239, 68, 68, 0.05)';
            }
        });
    }

    /**
     * Очистка подсветки ошибок
     */
    clearHighlights(formElement) {
        formElement.querySelectorAll('.input-error').forEach(el => {
            el.classList.remove('input-error');
            el.style.borderColor = '';
            el.style.backgroundColor = '';
        });
    }
}

// Создаём глобальный экземпляр
if (typeof window !== 'undefined') {
    window.inventoryValidator = new InventoryValidator();
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = InventoryValidator;
}

