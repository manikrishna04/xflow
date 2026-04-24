## TradEdge Frontend

This Next.js app is the frontend for the TradEdge exporter workflow. It keeps the
existing frontend contract of calling `/api/xflow/*`, but those route handlers now
proxy requests to the standalone `tradedge-fastapi` microservice.

## Getting Started

1. Start `tradedge-fastapi` first and set its `.env`.
2. In this `xflow` app, create `.env.local` from `.env.example`.
3. Set `XFLOW_MICROSERVICE_BASE_URL` to the FastAPI base URL, for example:

```bash
XFLOW_MICROSERVICE_BASE_URL=http://127.0.0.1:8000/api/xflow
```

4. Run the frontend:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Architecture

- Browser code calls `/api/xflow/*`
- Next.js route handlers proxy those requests to `tradedge-fastapi`
- `tradedge-fastapi` owns `XFLOW_SECRET_KEY`, platform account ids, and direct Xflow API calls

This keeps the frontend stable while moving operational secrets and Xflow orchestration
into the backend service.

## Production Notes

- Put `XFLOW_MICROSERVICE_BASE_URL` on the frontend deployment
- Put `XFLOW_SECRET_KEY`, `XFLOW_PARENT_ACCOUNT_ID` or `XFLOW_PLATFORM_ACCOUNT_ID`, and CORS settings on `tradedge-fastapi`
- Keep the frontend talking only to the microservice, not directly to Xflow
- If you deploy both behind one domain, keep `/api/xflow/*` routed through the Next.js app or an edge proxy consistently

## Build

```bash
npm run build
```

## Notes

- Legacy `XFLOW_*` variables can stay in local frontend env files during migration, but the new intended source of truth is `XFLOW_MICROSERVICE_BASE_URL`
- Local exporter and invoice state still lives in browser storage for this demo workspace
