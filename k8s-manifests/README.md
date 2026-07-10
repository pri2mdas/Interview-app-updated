# k8s-manifests — Take My Interview

Production-grade Kubernetes manifests for the **Take My Interview** platform.
Three workloads: PostgreSQL (StatefulSet), FastAPI backend (Deployment), nginx
frontend (Deployment). All wired together with Services, Ingress, Network
Policies, HPAs, PDBs, and dedicated ServiceAccounts.

## Layout

```
k8s-manifests/
├── 00-namespace.yaml               Namespace + Pod Security Standards
├── 10-postgres-secret.yaml         Postgres credentials
├── 11-postgres-statefulset.yaml    Single-primary Postgres + PVC
├── 12-postgres-service.yaml        Headless + ClusterIP services
├── 13-postgres-serviceaccount.yaml No-API-access SA
├── 20-backend-configmap.yaml       Non-secret env (CORS, LOG_LEVEL…)
├── 21-backend-secret.yaml          DATABASE_URL, GEMINI_API_KEY, JWT_SECRET
├── 22-backend-deployment.yaml      FastAPI deployment (2 replicas, probes)
├── 23-backend-service.yaml         ClusterIP service
├── 24-backend-hpa.yaml             CPU + memory autoscaler
├── 25-backend-pdb.yaml             Keep ≥1 replica during disruptions
├── 26-backend-serviceaccount.yaml  No-API-access SA
├── 30-frontend-configmap.yaml      nginx.conf (env-specific)
├── 31-frontend-deployment.yaml     nginx deployment (2 replicas)
├── 32-frontend-service.yaml        ClusterIP service
├── 33-frontend-hpa.yaml            CPU autoscaler
├── 34-frontend-pdb.yaml            Keep ≥1 replica during disruptions
├── 35-frontend-serviceaccount.yaml No-API-access SA
├── 40-ingress.yaml                 TLS-terminated public entrypoint
├── 50-network-policies.yaml        Default-deny + scoped allow-rules
└── kustomization.yaml              Apply this to deploy the whole stack
```

## Prerequisites

- Kubernetes **1.27+** (for `autoscaling/v2`, `policy/v1` PDB, NetworkPolicy)
- A CNI that enforces NetworkPolicy (Calico, Cilium, Weave). The policies in
  `50-network-policies.yaml` are no-ops on clusters without one.
- `metrics-server` for HPAs (default on EKS/GKE/AKS; install manually otherwise).
- `cert-manager` and the `ingress-nginx` controller if you want auto-TLS.
- `kubectl` ≥ 1.27 with `kustomize` built in (or `kustomize` CLI ≥ 5).

## Quick start

```bash
# 1. Edit secrets first (NEVER commit real values).
$EDITOR 10-postgres-secret.yaml 21-backend-secret.yaml
#    Generate strong passwords with: openssl rand -base64 32

# 2. Edit the ingress host + TLS issuer to match your DNS / cluster.
$EDITOR 40-ingress.yaml

# 3. (Optional) Push your container images to a registry your cluster can
#    pull from, then either edit 22-backend-deployment.yaml /
#    31-frontend-deployment.yaml or add a kustomize overlay.

# 4. Apply.
kubectl apply -k .

# 5. Watch everything come up.
kubectl -n tmi get pods,svc,ingress,hpa,pdb -w

# 6. Get the ingress address.
kubectl -n tmi get ingress take-my-interview -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'
```

## Configuration knobs

| Where                                  | What                                          |
|----------------------------------------|-----------------------------------------------|
| `10-postgres-secret.yaml`              | `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` |
| `11-postgres-statefulset.yaml`         | storage size, storage class, resources, replica count |
| `20-backend-configmap.yaml`            | `CORS_ORIGINS`, `LOG_LEVEL`, `DB_POOL_MAX`    |
| `21-backend-secret.yaml`               | `DATABASE_URL`, `GEMINI_API_KEY`, `TMI_JWT_SECRET` |
| `22-backend-deployment.yaml`           | replicas, resources, image                    |
| `24-backend-hpa.yaml`                  | min/max replicas, CPU/memory targets          |
| `30-frontend-configmap.yaml`           | nginx config (proxy upstream, gzip, caching)  |
| `31-frontend-deployment.yaml`          | replicas, resources, image                    |
| `40-ingress.yaml`                      | host, TLS secret, ingress class, annotations  |

## How the pieces fit together

```
                    Internet
                       │
                       ▼
                ┌──────────────┐
                │ Ingress (TLS)│   take-my-interview.example.com
                └──────┬───────┘
                       │
        ┌──────────────┴──────────────┐
        ▼                             ▼
  /api/*  → backend:7000        /  → frontend:80
        │                             │
        ▼                             ▼
  FastAPI pod ×2                nginx pod ×2
   (Stateless)                  (Static bundle)
        │
        ▼
  postgres:5432
   (StatefulSet, 1 replica, 10Gi PVC)
```

## Production checklist

- [ ] Replace all `REPLACE_ME` / placeholder passwords with real secrets
      (prefer `external-secrets` or `sealed-secrets` over plaintext YAML).
- [ ] Set `storageClassName` in `11-postgres-statefulset.yaml` to a real
      provisioner (e.g. `gp3`, `pd-ssd`, `managed-csi`).
- [ ] Point `DATABASE_URL` at a real `postgres.tmi.svc.cluster.local:5432`
      host (and the matching password) — the default points at the in-cluster
      service.
- [ ] Configure `CORS_ORIGINS` to the real frontend origin(s).
- [ ] Replace `take-my-interview.example.com` in `40-ingress.yaml` and the
      TLS host list with your real hostname(s).
- [ ] Set `images:` in an overlay so deployments pull from your registry.
- [ ] Verify `kubectl auth can-i create namespace` and that you have RBAC to
      create CRDs if you use cert-manager / ingress-nginx operators.
- [ ] (Recommended) Run `kube-bench` and `polaris` against the cluster.
- [ ] (Recommended) Add a backup CronJob for the postgres PVC (e.g.
      `pg_dump` to S3) — the StatefulSet alone does not protect data.

## Day-2 commands

```bash
# Tail logs from every backend pod.
kubectl -n tmi logs -l app.kubernetes.io/name=backend -f

# Open a shell in a backend pod.
kubectl -n tmi exec -it deploy/backend -- sh

# Connect to Postgres from inside the cluster.
kubectl -n tmi exec -it statefulset/postgres -- psql -U tmi -d tmi

# Force a rolling restart of the backend (e.g. after a configmap change).
kubectl -n tmi rollout restart deploy/backend

# Scale the backend manually.
kubectl -n tmi scale deploy/backend --replicas=5

# Drain a node without downtime (PDBs ensure at least 1 replica stays up).
kubectl drain <node> --ignore-daemonsets
```

## Notes / known limitations

- **In-memory `interviews_db` dict** in `server.py` is process-local. With 2+
  backend replicas, an interview started on pod A will not be findable on pod
  B. Move this state to Postgres (or Redis) before scaling beyond 1 replica.
- **Single-replica Postgres** is fine up to a few hundred writes/sec, but is a
  SPOF. For higher availability, use a Postgres operator (Zalando, Crunchy,
  CloudNativePG) that manages streaming replication + automatic failover.
- **No metric exporter** is bundled. Add `prometheus-client` to the backend
  and a `ServiceMonitor` if you want Prometheus to scrape it.
