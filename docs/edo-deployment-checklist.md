# EDO Deployment Checklist (Diadoc Integration)

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment**
   - Copy `docs/edo-env-template.md` into a `.env` file (never commit it).
   - Fill in PostgreSQL credentials and Diadoc token/box ID.
   - Provide `CRYPTO_AGENT_URL` if a CryptoPro proxy is available.

3. **Run database migrations**
   ```bash
   psql "$DB_NAME" < migrations/20251110_add_edo_tables.sql
   ```

4. **Start the server**
   ```bash
   npm start
   ```
   The API will listen on `http://localhost:8080` by default.

5. **Smoke tests**
   - `GET /api/edo/health` – verifies configuration.
   - `GET /api/edo/documents` – should return Diadoc documents (or demo data if the token is absent).
   - `GET /api/edo/documents/{docflowId}/parse` – downloads and parses the seller title.

6. **Front-end verification**
   - Open the admin panel → “ЭДО”.
   - Ensure the documents list, line parsing, receipt creation, and signature actions respond from the new API.

7. **Enable signature flow**
   - Configure CryptoPro/Cloud signing service.
   - Implement `CRYPTO_AGENT_URL` endpoint or extend `/documents/:docflowId/sign` with real signing logic.

8. **Production rollout**
   - Deploy the Node server alongside existing services.
   - Register the system token with Контур.Диадок and whitelist IPs if required.
   - Monitor logs (`logs/edo.log` or STDOUT) and database records for the first batch of documents.

