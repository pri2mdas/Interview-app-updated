# k8s-manifests-simple — Take My Interview (AWS ALB)

Minimal production-grade K8s manifests for EKS / any cluster running the
**AWS Load Balancer Controller**.

## Files

```
k8s-manifests-simple/
├── namespace.yaml            Namespace
├── postgres.yaml             Secret + PVC + Deployment + Service
├── backend.yaml              ConfigMap + Secret + Deployment + Service
├── frontend.yaml             Deployment + Service
├── ingress.yaml              AWS ALB Ingress (HTTPS via ACM cert)`
```

## Prereqs

1. **AWS Load Balancer Controller** installed in the cluster:
   [REDACTED-URL]
2. **ACM certificate** for your domain in the same region as the cluster.
   Copy its ARN (looks like `arn:aws:acm:us-east-1:111122223333:certificate/abc…`).
3. **EC2 / Fargate nodes** with IAM permission to manage ALBs.
4. **AWS VPC CNI** so pods get real IPs (required for `target-type: ip`).

## Deploy

Add docker secrets to pull the image from docker hub
```bash
kubectl create secret docker-registry dockerhub-secret \
  --docker-server=https://index.docker.io/v1/ \
  --docker-username='<DOCKER_USERNAME>' \
  --docker-password='<DOCKER_ACCESS_TOKEN>' \
  -n tmi

# 2. Apply.
kubectl apply -f .

# 3. Watch the ALB come up (~1–2 min).
kubectl -n tmi get ingress take-my-interview -w

# 4. Get the ALB's DNS name and point your domain at it (Route 53 alias).
kubectl -n tmi get ingress take-my-interview \
  -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'
```

## Layout

```
        ┌────────────────────────┐
        │  AWS ALB (HTTPS :443)  │   ACM cert attached
        │  ACM: take-my-interview│
        └──────────┬─────────────┘
                   │
       ┌───────────┴────────────┐
       ▼                        ▼
  /api/* → backend:7000    / → frontend:80
       │                        │
       ▼                        ▼
   FastAPI pods              nginx pods
       │
       ▼
  postgres:5432  (Deployment + PVC)
```

## Notes

- Single-instance Postgres Deployment — fine for dev / low traffic. Swap
  for a StatefulSet or run a managed RDS for production HA.
- TLS is terminated at the ALB. Plain HTTP between ALB and pods is fine
  inside the VPC.
- If you don't have an ACM cert yet, you can temporarily drop
  `certificate-arn` and `listen-ports` to use HTTP-only for testing.
