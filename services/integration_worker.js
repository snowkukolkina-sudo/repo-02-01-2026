const path = require('path');
const fs = require('fs-extra');

const STORAGE_DIR = path.join(process.cwd(), 'storage', 'catalog');
const EVENTS_FILE = path.join(STORAGE_DIR, 'integration-events.jsonl');
const JOBS_FILE = path.join(process.cwd(), 'storage', 'integrations', 'jobs.jsonl');
const SETTINGS_FILE = path.join(process.cwd(), 'storage', 'integrations', 'settings.json');
const WORKER_STATE_FILE = path.join(process.cwd(), 'storage', 'integrations', 'worker-state.json');
const OUTBOX_DIR = path.join(process.cwd(), 'storage', 'integrations', 'outbox');

const MAX_PROCESSED_EVENT_IDS = 2000;
const MAX_JOB_ATTEMPTS = 3;
const MAX_JOBS_PER_TICK = 25;

async function ensureWorkerStorage() {
    await fs.ensureDir(path.dirname(JOBS_FILE));
    await fs.ensureDir(path.dirname(WORKER_STATE_FILE));
}

async function loadWorkerState() {
    try {
        await ensureWorkerStorage();
        if (await fs.pathExists(WORKER_STATE_FILE)) {
            const state = await fs.readJson(WORKER_STATE_FILE);
            const ids = Array.isArray(state?.processedEventIds) ? state.processedEventIds : [];
            return {
                processedEventIds: ids.filter(Boolean).map(String).slice(-MAX_PROCESSED_EVENT_IDS)
            };
        }
    } catch (e) {
        // ignore
    }
    return { processedEventIds: [] };
}

async function saveWorkerState(state) {
    try {
        await ensureWorkerStorage();
        const ids = Array.isArray(state?.processedEventIds) ? state.processedEventIds : [];
        const normalized = ids.filter(Boolean).map(String).slice(-MAX_PROCESSED_EVENT_IDS);
        await fs.writeJson(WORKER_STATE_FILE, { processedEventIds: normalized }, { spaces: 2 });
    } catch (e) {
        // ignore
    }
}

async function appendJob(job) {
    await ensureWorkerStorage();
    const line = JSON.stringify(job);
    await fs.appendFile(JOBS_FILE, line + '\n', 'utf8');
}

async function readJobsFile() {
    await ensureWorkerStorage();
    if (!(await fs.pathExists(JOBS_FILE))) {
        return [];
    }
    const content = await fs.readFile(JOBS_FILE, 'utf8');
    if (!content.trim()) return [];
    const lines = content.split('\n');
    const jobs = [];
    for (const line of lines) {
        const trimmed = String(line || '').trim();
        if (!trimmed) continue;
        try {
            const job = JSON.parse(trimmed);
            if (job && typeof job === 'object') jobs.push(job);
        } catch (_) {
            // ignore bad lines
        }
    }
    return jobs;
}

async function writeJobsFile(jobs) {
    await ensureWorkerStorage();
    const lines = (Array.isArray(jobs) ? jobs : [])
        .filter(Boolean)
        .map((j) => JSON.stringify(j));
    const out = lines.length ? (lines.join('\n') + '\n') : '';
    await fs.writeFile(JOBS_FILE, out, 'utf8');
}

async function writeOutbox(integrationKey, job) {
    const safeKey = String(integrationKey || 'unknown').toLowerCase();
    const dir = path.join(OUTBOX_DIR, safeKey);
    await fs.ensureDir(dir);
    const filename = `${String(job.jobId || 'job')}.json`;
    const absPath = path.join(dir, filename);
    const payload = {
        jobId: job.jobId,
        integration: job.integration,
        jobType: job.jobType,
        createdAt: job.createdAt,
        payload: job.payload || null
    };
    await fs.writeJson(absPath, payload, { spaces: 2 });
    const relPath = path.join('storage', 'integrations', 'outbox', safeKey, filename).replace(/\\/g, '/');
    const url = `/storage/integrations/outbox/${safeKey}/${encodeURIComponent(filename)}`;
    return { absPath, relPath, url };
}

/**
 * Worker для обработки событий из integration bus
 */
class IntegrationWorker {
    constructor() {
        this.isRunning = false;
        this.processingInterval = null;
        this.intervalMs = 5000; // Проверяем новые события каждые 5 секунд
        this.processedEvents = new Set();
        this.workerState = { processedEventIds: [] };
    }

    /**
     * Запуск worker'а
     */
    start() {
        if (this.isRunning) {
            console.log('[Worker] Already running');
            return;
        }

        console.log('[Worker] Starting integration worker...');
        this.isRunning = true;
        // Load persisted state (best-effort)
        loadWorkerState()
            .then((state) => {
                this.workerState = state;
                this.processedEvents = new Set(state.processedEventIds || []);
            })
            .catch(() => {
                // ignore
            })
            .finally(() => {
                this.processEventsLoop();
            });
    }

    /**
     * Остановка worker'а
     */
    stop() {
        if (!this.isRunning) {
            return;
        }

        console.log('[Worker] Stopping integration worker...');
        this.isRunning = false;
        if (this.processingInterval) {
            clearInterval(this.processingInterval);
            this.processingInterval = null;
        }
    }

    /**
     * Основной цикл обработки событий
     */
    async processEventsLoop() {
        await this.processNewEvents();
        await this.processJobs();
        
        if (this.isRunning) {
            this.processingInterval = setTimeout(() => {
                this.processEventsLoop();
            }, this.intervalMs);
        }
    }

    /**
     * Обработка новых событий
     */
    async processNewEvents() {
        try {
            const events = await this.getUnprocessedEvents();
            
            for (const event of events) {
                if (this.processedEvents.has(event.id)) {
                    continue; // Уже обработано
                }

                try {
                    await this.processEvent(event);
                    this.processedEvents.add(event.id);
                    this.workerState.processedEventIds = Array.from(this.processedEvents).slice(-MAX_PROCESSED_EVENT_IDS);
                    await saveWorkerState(this.workerState);
                    console.log(`[Worker] Processed event: ${event.type} (${event.id})`);
                } catch (error) {
                    console.error(`[Worker] Error processing event ${event.id}:`, error.message);
                    // Не добавляем в processedEvents, чтобы попробовать обработать позже
                }
            }
        } catch (error) {
            console.error('[Worker] Error in processNewEvents:', error.message);
        }
    }

    /**
     * Получение необработанных событий
     */
    async getUnprocessedEvents() {
        try {
            if (!(await fs.pathExists(EVENTS_FILE))) {
                return [];
            }

            const content = await fs.readFile(EVENTS_FILE, 'utf8');
            if (!content.trim()) {
                return [];
            }

            const lines = content.trim().split('\n');
            const events = [];

            // Читаем с конца файла (последние события)
            for (let i = lines.length - 1; i >= 0 && events.length < 100; i--) {
                const line = lines[i].trim();
                if (!line) continue;

                try {
                    const event = JSON.parse(line);
                    if (event && event.id && !this.processedEvents.has(event.id)) {
                        events.push(event);
                    }
                } catch (e) {
                    // Пропускаем некорректные строки
                }
            }

            return events.reverse(); // Возвращаем в хронологическом порядке
        } catch (error) {
            console.error('[Worker] Error reading events:', error.message);
            return [];
        }
    }

    /**
     * Обработка отдельного события
     */
    async processEvent(event) {
        switch (event.type) {
            case 'DOCUMENT_POSTED':
                await this.handleDocumentPosted(event);
                break;
            case 'STOCK_CHANGED':
                await this.handleStockChanged(event);
                break;
            case 'PRODUCT_UPDATED':
                await this.handleProductUpdated(event);
                break;
            default:
                console.log(`[Worker] Unknown event type: ${event.type}`);
        }
    }

    /**
     * Обработка события DOCUMENT_POSTED
     */
    async handleDocumentPosted(event) {
        const documentId = event.document_id;
        const documentType = event.document_type;
        
        console.log(`[Worker] Document posted: ${documentId} (${documentType})`);
        
        // Отправляем событие в ERP системы, если они включены
        const settings = await this.loadSettings();
        
        if (settings.onec?.enabled) {
            await this.sendToOneC(event);
        }
        
        if (settings.rkeeper?.enabled) {
            await this.sendToRKeeper(event);
        }
        
        if (settings.kontur?.enabled) {
            await this.sendToKontur(event);
        }
    }

    /**
     * Обработка события STOCK_CHANGED
     */
    async handleStockChanged(event) {
        const productId = event.product_id;
        const newQuantity = event.new_quantity;
        
        console.log(`[Worker] Stock changed: product ${productId}, quantity ${newQuantity}`);
        
        // Отправляем событие в ERP системы
        const settings = await this.loadSettings();
        
        if (settings.onec?.enabled) {
            await this.sendStockToOneC(event);
        }
        
        if (settings.rkeeper?.enabled) {
            await this.sendStockToRKeeper(event);
        }
    }

    /**
     * Обработка события PRODUCT_UPDATED
     */
    async handleProductUpdated(event) {
        const productId = event.product_id;
        
        console.log(`[Worker] Product updated: ${productId}`);
        
        // Можно отправлять в маркетплейсы или другие системы
    }

    /**
     * Отправка в 1С
     */
    async sendToOneC(event) {
        const job = {
            jobId: `job-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            status: 'queued',
            integration: 'onec',
            jobType: 'DOCUMENT_POSTED',
            createdAt: new Date().toISOString(),
            payload: event
        };
        await appendJob(job);
    }

    /**
     * Отправка в r_keeper
     */
    async sendToRKeeper(event) {
        const job = {
            jobId: `job-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            status: 'queued',
            integration: 'rkeeper',
            jobType: 'DOCUMENT_POSTED',
            createdAt: new Date().toISOString(),
            payload: event
        };
        await appendJob(job);
    }

    /**
     * Отправка в Контур
     */
    async sendToKontur(event) {
        const job = {
            jobId: `job-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            status: 'queued',
            integration: 'kontur',
            jobType: 'DOCUMENT_POSTED',
            createdAt: new Date().toISOString(),
            payload: event
        };
        await appendJob(job);
    }

    /**
     * Отправка остатков в 1С
     */
    async sendStockToOneC(event) {
        const job = {
            jobId: `job-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            status: 'queued',
            integration: 'onec',
            jobType: 'STOCK_CHANGED',
            createdAt: new Date().toISOString(),
            payload: event
        };
        await appendJob(job);
    }

    /**
     * Отправка остатков в r_keeper
     */
    async sendStockToRKeeper(event) {
        const job = {
            jobId: `job-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            status: 'queued',
            integration: 'rkeeper',
            jobType: 'STOCK_CHANGED',
            createdAt: new Date().toISOString(),
            payload: event
        };
        await appendJob(job);
    }

    /**
     * Загрузка настроек интеграций
     */
    async loadSettings() {
        try {
            if (await fs.pathExists(SETTINGS_FILE)) {
                return await fs.readJSON(SETTINGS_FILE);
            }
        } catch (error) {
            console.error('[Worker] Error loading settings:', error.message);
        }
        return {};
    }

    /**
     * Обработка job'ов из очереди
     */
    async processJobs() {
        try {
            const settings = await this.loadSettings();
            const allJobs = await readJobsFile();
            if (!allJobs.length) return;

            const now = new Date().toISOString();
            let processed = 0;

            for (const job of allJobs) {
                if (!job || job.status !== 'queued') continue;
                if (processed >= MAX_JOBS_PER_TICK) break;
                processed += 1;
                try {
                    job.status = 'in_progress';
                    job.startedAt = job.startedAt || now;
                    job.attempts = Number.isFinite(job.attempts) ? job.attempts : 0;
                    job.attempts += 1;
                    await this.processJob(job, settings);
                } catch (error) {
                    job.lastError = error.message;
                    if ((job.attempts || 1) >= MAX_JOB_ATTEMPTS) {
                        job.status = 'failed';
                        job.failedAt = new Date().toISOString();
                    } else {
                        job.status = 'queued';
                    }
                    console.error(`[Worker] Error processing job ${job.jobId}:`, error.message);
                }
            }

            if (processed > 0) {
                await writeJobsFile(allJobs);
            }
        } catch (error) {
            console.error('[Worker] Error processing jobs:', error.message);
        }
    }

    /**
     * Обработка отдельного job'а
     */
    async processJob(job, settings = {}) {
        console.log(`[Worker] Processing job: ${job.jobType} for ${job.integration}`);

        const integrationKey = String(job.integration || '').toLowerCase();
        const integrationSettings = settings?.[integrationKey] || {};
        const enabled = Boolean(integrationSettings?.enabled);

        if (!enabled) {
            job.status = 'failed';
            job.failedAt = new Date().toISOString();
            job.lastError = 'integration_disabled';
            return;
        }

        const outbox = await writeOutbox(integrationKey, job);
        job.status = 'completed';
        job.completedAt = new Date().toISOString();
        job.result = {
            ok: true,
            note: 'written_to_outbox',
            outboxPath: outbox.relPath,
            outboxUrl: outbox.url
        };
    }
}

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = IntegrationWorker;
}

// Если запущен напрямую, стартуем worker
if (require.main === module) {
    const worker = new IntegrationWorker();
    worker.start();
    
    // Graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n[Worker] Shutting down...');
        worker.stop();
        process.exit(0);
    });
    
    process.on('SIGTERM', () => {
        console.log('\n[Worker] Shutting down...');
        worker.stop();
        process.exit(0);
    });
}
