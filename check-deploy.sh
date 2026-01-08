#!/bin/bash

echo "🔍 Диагностика автодеплоя на сервере testdandypizza"
echo "=================================================="
echo ""

# 1. Проверка cron задач
echo "1️⃣ Проверка cron задач:"
echo "------------------------"
crontab -l 2>/dev/null | grep -i deploy
if [ $? -ne 0 ]; then
    echo "❌ Cron задачи для деплоя НЕ НАЙДЕНЫ"
else
    echo "✅ Найдены cron задачи"
fi
echo ""

# 2. Проверка PM2 процессов
echo "2️⃣ Проверка PM2 процессов:"
echo "------------------------"
pm2 list 2>/dev/null | grep -E "webhook|deploy"
if [ $? -ne 0 ]; then
    echo "❌ Webhook процессы НЕ НАЙДЕНЫ в PM2"
else
    echo "✅ Найдены webhook процессы"
fi
echo ""

# 3. Проверка текущего коммита на сервере
echo "3️⃣ Текущий коммит на сервере:"
echo "------------------------"
cd /var/www/testdandypizza 2>/dev/null
if [ $? -eq 0 ]; then
    echo "📍 Локальный коммит:"
    git log -1 --oneline 2>/dev/null
    echo ""
    echo "📍 Удалённый коммит (origin/main):"
    git fetch origin main 2>/dev/null
    git log origin/main -1 --oneline 2>/dev/null
    echo ""

    LOCAL=$(git rev-parse HEAD 2>/dev/null)
    REMOTE=$(git rev-parse origin/main 2>/dev/null)

    if [ "$LOCAL" = "$REMOTE" ]; then
        echo "✅ Сервер синхронизирован с GitHub"
    else
        echo "⚠️ Сервер ОТСТАЁТ от GitHub!"
        echo "   Нужно запустить: bash /var/www/testdandypizza/deploy.sh"
    fi
else
    echo "❌ Директория /var/www/testdandypizza не найдена"
fi
echo ""

# 4. Проверка прав на deploy.sh
echo "4️⃣ Проверка прав на deploy.sh:"
echo "------------------------"
if [ -f /var/www/testdandypizza/deploy.sh ]; then
    ls -la /var/www/testdandypizza/deploy.sh
    if [ -x /var/www/testdandypizza/deploy.sh ]; then
        echo "✅ Скрипт имеет права на выполнение"
    else
        echo "⚠️ Скрипт НЕ ИМЕЕТ прав на выполнение!"
        echo "   Исправить: chmod +x /var/www/testdandypizza/deploy.sh"
    fi
else
    echo "❌ Файл deploy.sh не найден"
fi
echo ""

# 5. Проверка логов деплоя
echo "5️⃣ Последние логи деплоя:"
echo "------------------------"
if [ -f /var/www/testdandypizza/deploy.log ]; then
    echo "Последние 10 строк из deploy.log:"
    tail -10 /var/www/testdandypizza/deploy.log
else
    echo "⚠️ Файл deploy.log не найден (логи не ведутся)"
fi
echo ""

# 6. Проверка GitHub webhooks
echo "6️⃣ Проверка webhook на порту 9000:"
echo "------------------------"
netstat -tulpn 2>/dev/null | grep :9000
if [ $? -ne 0 ]; then
    echo "❌ Webhook сервер НЕ ЗАПУЩЕН на порту 9000"
else
    echo "✅ Webhook сервер работает"
fi
echo ""

# Итоговое резюме
echo "📋 РЕЗЮМЕ:"
echo "=========================="
echo ""
echo "Возможные причины проблемы:"
echo ""
echo "1. ❌ НЕТ cron задачи - скрипт не запускается по расписанию"
echo "2. ❌ НЕТ webhook сервера - GitHub не может уведомить сервер"
echo "3. ❌ НЕТ GitHub Actions - нет автоматического деплоя через SSH"
echo ""
echo "Рекомендации:"
echo ""
echo "✅ Вариант 1 (рекомендуется): Настроить GitHub Actions"
echo "   - Добавить SSH ключ на сервер"
echo "   - Добавить секреты в GitHub"
echo "   - Workflow уже создан в .github/workflows/deploy.yml"
echo ""
echo "✅ Вариант 2: Настроить cron задачу"
echo "   - Выполнить: crontab -e"
echo "   - Добавить: */5 * * * * /bin/bash /var/www/testdandypizza/deploy.sh >> /var/www/testdandypizza/deploy.log 2>&1"
echo ""
echo "✅ Вариант 3: Запустить webhook сервер"
echo "   - pm2 start /var/www/testdandypizza/webhook-deploy.js --name dandy-webhook"
echo "   - Настроить webhook в GitHub Settings"
echo ""
echo "📖 Полная инструкция: docs/auto-deploy-setup.md"
echo ""
