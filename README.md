# Kube-Obs
<div align="center">
  <img src="images/background.png" alt="Background Image" width="75%"/>
  <br><br>
</div>

This is a repository containing a Node API, deployed using Kubernetes, and Observed using Prometheus and Grafana.

The source code for the Node API is under the **app** folder, while the Kubernetes manifests can be found under the **k8s** folder.

Prometheus and Grafana can be installed to use with this repository by using [Helm](https://helm.sh/) to install the [official prometheus-community repo](https://github.com/prometheus-community/helm-charts).
The Kubernetes manifests expects the full kube-prometheus-stack to be under the **monitoring** namespace, this however can be changed.

In order to replicate/fully install the kube-prometheus-stack:
```
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

kubectl create namespace monitoring

helm install monitoring prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --set grafana.adminPassword=[YOUR_GRAFANA_ADMIN_PASSWORD] \
  --set prometheus.prometheusSpec.serviceMonitorSelectorNilUsesHelmValues=false \
  --create-namespace=false
```

The DockerHub Repository for the application image can be found [here](https://hub.docker.com/repository/docker/shahlll/kube-obs-api/general)

Contributions and feedback are more than welcomed. 

When contributing to this project or using it in any way, please do pay attention to: [LICENSE](https://github.com/shahLLL/Kube-Obs?tab=Apache-2.0-1-ov-file)

☕☕☕**CHEERS AND THANK YOU**☕☕☕


