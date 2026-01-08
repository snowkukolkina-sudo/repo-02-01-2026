#!/bin/bash
cd /var/www/testdandypizza

git config --global --add safe.directory /var/www/testdandypizza

git fetch origin main

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ $LOCAL != $REMOTE ]; then
    echo "🔄 Обнаружены изменения, обновляем..."
    git pull origin main

    echo "📦 Устанавливаем зависимости..."
    npm install --production

    echo "🔄 Перезапускаем приложение..."
    pm2 restart dandy-pizza

    echo "✅ Обновление завершено: $(date)"
else
    echo "✨ Изменений нет: $(date)"
fi
