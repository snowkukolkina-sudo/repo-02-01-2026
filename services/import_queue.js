const EventEmitter = require('events');
const path = require('path');
const store = require('./import_store');
const ocrProvider = require('./ocr_provider');
const fuzzyMatcher = require('./fuzzy_matcher');

class ImportQueue extends EventEmitter {
    constructor() {
        super();
        this.jobs = new Map();
        this.queue = [];
        this.isProcessing = false;
    }

    async registerJob(jobId, payload = {}) {
        const jobDir = await store.getJobDir(jobId);
        if (!jobDir) {
            throw new Error(`Job directory not found for ${jobId}`);
        }
        const entry = {
            id: jobId,
            jobDir,
            status: payload.status || 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            meta: payload.meta || {}
        };
        this.jobs.set(jobId, entry);
        return entry;
    }

    getJob(jobId) {
        return this.jobs.get(jobId) || null;
    }

    async setJobStatus(jobId, status, extra = {}) {
        const job = this.getJob(jobId);
        if (!job) return null;
        job.status = status;
        job.updatedAt = new Date().toISOString();
        job.meta = { ...job.meta, ...extra };
        this.jobs.set(jobId, job);
        this.emit('status', { id: jobId, status, meta: job.meta });
        await store.appendLog(job.jobDir, { level: 'info', message: `Status -> ${status}` });
        return job;
    }

    enqueue(jobId, payload) {
        const job = this.getJob(jobId);
        if (!job) {
            throw new Error(`Job ${jobId} is not registered`);
        }
        job.payload = payload;
        this.queue.push(job);
        this.setJobStatus(jobId, 'queued');
        this.processQueue();
        return job;
    }

    async registerImmediateResult(jobId, result, message = 'Файл обработан синхронно') {
        const job = this.getJob(jobId);
        if (!job) {
            throw new Error(`Job ${jobId} не найден для записи результата`);
        }
        const enriched = this.enrichWithMatching(result, job);
        await store.writeResult(job.jobDir, enriched);
        if (enriched.metrics) {
            await store.writeMetrics(job.jobDir, enriched.metrics);
            await store.appendLog(job.jobDir, {
                level: 'info',
                message: `Fuzzy-matching: ${enriched.metrics.withSuggestions}/${enriched.metrics.rowsTotal} строк, средний скор ${enriched.metrics.avgScore}`
            });
        }
        await store.appendLog(job.jobDir, { level: 'info', message });
        await this.setJobStatus(jobId, 'completed', { message });
        return this.getJob(jobId);
    }

    async processQueue() {
        if (this.isProcessing) return;
        const job = this.queue.shift();
        if (!job) return;
        this.isProcessing = true;
        try {
            await this.setJobStatus(job.id, 'processing');
            await store.appendLog(job.jobDir, {
                level: 'info',
                message: `Начата обработка файла ${path.basename(job.payload.filePath)}`
            });
            const result = await ocrProvider.process(job);
            const enriched = this.enrichWithMatching(result, job);
            await store.writeResult(job.jobDir, enriched);
            if (enriched.metrics) {
                await store.writeMetrics(job.jobDir, enriched.metrics);
                await store.appendLog(job.jobDir, {
                    level: 'info',
                    message: `Fuzzy-matching: ${enriched.metrics.withSuggestions}/${enriched.metrics.rowsTotal} строк, средний скор ${enriched.metrics.avgScore}`
                });
            }
            await store.appendLog(job.jobDir, { level: 'info', message: 'Обработка завершена' });
            await this.setJobStatus(job.id, 'completed', { message: 'Файл готов' });
        } catch (error) {
            await store.appendLog(job.jobDir, {
                level: 'error',
                message: error.message || 'Ошибка обработки'
            });
            await this.setJobStatus(job.id, 'failed', { error: error.message });
        } finally {
            this.isProcessing = false;
            setImmediate(() => this.processQueue());
        }
    }

    enrichWithMatching(result, job) {
        if (result && result.matches && result.metrics) {
            return result;
        }
        const headers = result.headers || [];
        const rows = result.rows || [];
        const reference = job?.meta?.referenceCatalog || null;
        const analysis = fuzzyMatcher.analyseDataset(headers, rows, reference);
        const merged = {
            ...result,
            matches: analysis.suggestions,
            metrics: analysis.metrics
        };
        return merged;
    }
}

module.exports = new ImportQueue();

