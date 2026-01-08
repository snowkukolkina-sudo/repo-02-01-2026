# Настройка автоматического деплоя

## Текущая проблема

Скрипт `deploy.sh` существует на сервере, но **не запускается автоматически** при push в GitHub. Нужно настроить один из механизмов автозапуска.

---

## Способ 1: GitHub Actions (Рекомендуется) ⭐

### Преимущества:
- ✅ Запускается мгновенно при push
- ✅ Логи деплоя видны в GitHub
- ✅ Не требует открытых портов на сервере
- ✅ Легко откатить неудачный деплой

### Настройка:

#### 1. Добавьте SSH ключ на сервере:

```bash
# На вашем компьютере создайте SSH ключ для деплоя
ssh-keygen -t ed25519 -C "github-deploy" -f ~/.ssh/github_deploy_key

# Скопируйте публичный ключ на сервер
ssh-copy-id -i ~/.ssh/github_deploy_key.pub user@your-server.com

# Или вручную добавьте содержимое github_deploy_key.pub в ~/.ssh/authorized_keys на сервере
```

#### 2. Добавьте секреты в GitHub:

Перейдите в **Settings → Secrets and variables → Actions** вашего репозитория и добавьте:

- `DEPLOY_HOST` - адрес сервера (например: `testdandypizza.com` или IP)
- `DEPLOY_USER` - пользователь SSH (например: `root` или `ubuntu`)
- `DEPLOY_SSH_KEY` - приватный ключ (содержимое файла `~/.ssh/github_deploy_key`)
- `DEPLOY_PORT` - порт SSH (обычно 22, можно не указывать)

#### 3. Workflow уже создан!

Файл `.github/workflows/deploy.yml` уже находится в репозитории и будет автоматически запускаться при каждом push в `main`.

#### 4. Проверьте работу:

```bash
# Сделайте любой коммит и push
git add .
git commit -m "Тест автодеплоя"
git push origin main

# Перейдите на вкладку Actions в GitHub и посмотрите логи
```

---

## Способ 2: GitHub Webhook + Node.js сервер

### Преимущества:
- ✅ Полный контроль над процессом деплоя
- ✅ Можно добавить дополнительную логику
- ✅ Работает без внешних сервисов

### Недостатки:
- ⚠️ Требует открытый порт (9000)
- ⚠️ Нужно настроить firewall и nginx reverse proxy

### Настройка:

#### 1. Установите webhook сервер на сервере:

```bash
# Скопируйте webhook-deploy.js на сервер
scp webhook-deploy.js user@server:/var/www/testdandypizza/

# На сервере настройте переменные окружения
cd /var/www/testdandypizza
nano .env

# Добавьте:
WEBHOOK_PORT=9000
WEBHOOK_SECRET=your-super-secret-key-here
```

#### 2. Запустите webhook через PM2:

```bash
pm2 start webhook-deploy.js --name "dandy-webhook"
pm2 save
```

#### 3. Настройте nginx reverse proxy:

```nginx
# В конфигурации вашего сайта добавьте:
location /webhook {
    proxy_pass http://localhost:9000/webhook;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

```bash
sudo nginx -t
sudo systemctl reload nginx
```

#### 4. Настройте webhook в GitHub:

1. Перейдите: **Settings → Webhooks → Add webhook**
2. Payload URL: `https://testdandypizza.com/webhook`
3. Content type: `application/json`
4. Secret: тот же, что в `.env` (WEBHOOK_SECRET)
5. Events: **Just the push event**
6. Active: ✅

#### 5. Проверьте:

```bash
# Сделайте push и проверьте логи webhook сервера
pm2 logs dandy-webhook

# Или проверьте логи деплоя
tail -f /var/www/testdandypizza/deploy.log
```

---

## Способ 3: Cron задача (Простой, но медленный)

### Преимущества:
- ✅ Максимально просто настроить
- ✅ Не требует внешних сервисов

### Недостатки:
- ⚠️ Задержка до 5 минут
- ⚠️ Лишние проверки Git даже без изменений

### Настройка:

```bash
# На сервере откройте crontab
crontab -e

# Добавьте строку (проверка каждые 5 минут):
*/5 * * * * /bin/bash /var/www/testdandypizza/deploy.sh >> /var/www/testdandypizza/deploy.log 2>&1

# Сохраните и проверьте:
crontab -l
```

---

## Способ 4: Git hooks на сервере (Не рекомендуется)

Этот способ требует bare репозиторий на сервере и усложняет процесс разработки. Используйте GitHub Actions вместо этого.

---

## Диагностика проблем

### Проблема 1: Скрипт не запускается

```bash
# Проверьте права на выполнение
ls -la /var/www/testdandypizza/deploy.sh

# Если нет прав, добавьте:
chmod +x /var/www/testdandypizza/deploy.sh
```

### Проблема 2: Git pull не работает

```bash
# Проверьте SSH ключи на сервере
ssh -T git@github.com

# Если ошибка аутентификации, добавьте SSH ключ:
ssh-keygen -t ed25519 -C "server@testdandypizza.com"
cat ~/.ssh/id_ed25519.pub
# Добавьте ключ в Settings → Deploy keys на GitHub
```

### Проблема 3: npm install падает с ошибкой

```bash
# Проверьте версию Node.js
node -v

# Должна быть >= 14.x, если нет:
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Проблема 4: PM2 не перезапускает приложение

```bash
# Проверьте список процессов PM2
pm2 list

# Если dandy-pizza не найден, запустите:
pm2 start server.js --name "dandy-pizza"
pm2 save
pm2 startup
```

### Проблема 5: GitHub Actions не может подключиться

```bash
# На сервере проверьте SSH логи
sudo tail -f /var/log/auth.log

# Убедитесь, что публичный ключ добавлен в authorized_keys
cat ~/.ssh/authorized_keys
```

---

## Мониторинг деплоя

### Просмотр логов GitHub Actions:

1. Откройте репозиторий на GitHub
2. Перейдите на вкладку **Actions**
3. Выберите последний workflow run
4. Посмотрите детали выполнения

### Просмотр логов webhook сервера:

```bash
pm2 logs dandy-webhook --lines 50
```

### Просмотр логов cron:

```bash
tail -f /var/www/testdandypizza/deploy.log
```

### Проверка последнего деплоя:

```bash
cd /var/www/testdandypizza
git log -1 --oneline
pm2 info dandy-pizza
```

---

## Рекомендация

**Используйте GitHub Actions (Способ 1)** - это современный, быстрый и надёжный способ с минимальной настройкой.

Если GitHub Actions по какой-то причине не подходит, используйте Webhook сервер (Способ 2).

Cron (Способ 3) оставьте как резервный вариант.

---

## Чеклист настройки (GitHub Actions)

- [ ] Создан SSH ключ для деплоя
- [ ] Публичный ключ добавлен на сервер в `~/.ssh/authorized_keys`
- [ ] Секреты добавлены в GitHub (DEPLOY_HOST, DEPLOY_USER, DEPLOY_SSH_KEY)
- [ ] Файл `.github/workflows/deploy.yml` закоммичен в репозиторий
- [ ] Сделан тестовый push в main
- [ ] Проверены логи в GitHub Actions
- [ ] Приложение успешно перезапущено на сервере

---

*Документ создан: 2026-01-08*
