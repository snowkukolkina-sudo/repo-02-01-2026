const express = require('express');
const authStore = require('../services/auth_store');

const router = express.Router();
router.use(express.json({ limit: '1mb' }));

function extractToken(req) {
    const header = req.headers.authorization || '';
    if (header.toLowerCase().startsWith('bearer ')) {
        return header.slice(7).trim();
    }
    return null;
}

function ok(data = null) {
    return { success: true, data };
}

function sendError(res, error) {
    if (error.status) {
        return res.status(error.status).json({
            success: false,
            error: error.message || 'Ошибка авторизации'
        });
    }
    return res.status(500).json({
        success: false,
        error: error.message || 'Internal server error'
    });
}

async function requireAuth(req, res, next) {
    try {
        const token = extractToken(req);
        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'Требуется авторизация'
            });
        }
        const session = await authStore.getSession(token);
        if (!session) {
            return res.status(401).json({
                success: false,
                error: 'Сессия недействительна'
            });
        }
        req.user = session.user;
        req.authToken = token;
        next();
    } catch (error) {
        sendError(res, error);
    }
}

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body || {};
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Укажите email и пароль'
            });
        }
        const result = await authStore.login(email, password);
        if (!result) {
            return res.status(401).json({
                success: false,
                error: 'Неверный email или пароль'
            });
        }
        res.json(
            ok({
                token: result.token,
                user: result.user
            })
        );
    } catch (error) {
        sendError(res, error);
    }
});

router.post('/logout', requireAuth, async (req, res) => {
    try {
        if (req.authToken) {
            await authStore.logout(req.authToken);
        }
        res.json(ok({ logged_out: true }));
    } catch (error) {
        sendError(res, error);
    }
});

router.get('/profile', requireAuth, async (req, res) => {
    try {
        res.json(ok(req.user));
    } catch (error) {
        sendError(res, error);
    }
});

module.exports = router;

