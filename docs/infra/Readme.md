Developer
    │
    ▼
GitHub
    │
    ▼
Pull Request
    │
    ├── Unit Tests
    ├── Integration Tests
    ├── SAST
    ├── SCA
    ├── Secret Scanning
    ├── IaC Scanning
    └── AI Code Review
             │
             ▼
         APPROVED
             │
             ▼
       Docker Build
             │
             ▼
      Container Scan
             │
             ▼
            ECR
             │
             ▼
       Deploy to EKS
             │
             ▼
       Kubernetes
        ┌────┴────┐
        │         │
      Pod 1     Pod 2
        │         │
        └────┬────┘
             │
             ▼
          RDS
       PostgreSQL