#!/bin/bash
cd /var/www/testdandypizza

# Добавляем директорию в safe.directory
git config --global --add safe.directory /var/www/testdandypizza

# Проверяем изменения
git fetch origin main

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ $LOCAL != $REMOTE ]; then
    echo "🔄 Обнаружены изменения, обновляем..."
    git pull origin main
    echo "✅ Обновление завершено: $(date)"
else
    echo "✨ Изменений нет: $(date)"
fi
