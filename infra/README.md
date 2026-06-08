# k3s Spark Infrastructure

This directory deploys a small Apache Spark standalone cluster into a
self-hosted k3s cluster.

Apply it with:

```sh
kubectl apply -k infra
```

Check the cluster:

```sh
kubectl -n data get pods,svc
kubectl -n data port-forward svc/spark-master 8080:8080
```

The Spark master URL inside the cluster is:

```text
spark://spark-master.data.svc.cluster.local:7077
```

The `kafka-env` ConfigMap contains the Kafka variables expected by the Next.js
app. Reference it from the app deployment with:

```yaml
envFrom:
  - configMapRef:
      name: kafka-env
```

If your Kafka cluster is in another namespace or hosted outside k3s, update
`KAFKA_BROKERS` in `kafka-env-configmap.yaml`.
