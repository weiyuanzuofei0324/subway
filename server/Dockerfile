# 第一阶段：编译环境
FROM docker.m.daocloud.io/library/golang:1.25-alpine AS builder
WORKDIR /app
ENV GOPROXY=https://goproxy.cn,direct

# 复制依赖描述文件并下载
COPY go.mod go.sum ./
RUN go mod download

# 复制后端所有源码并编译 API 服务和种子导入命令
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o main ./cmd/api
RUN CGO_ENABLED=0 GOOS=linux go build -o seed ./cmd/seed

# 第二阶段：运行环境（纯净无 Go 依赖的小镜像）
FROM docker.m.daocloud.io/library/alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /app

# 从编译阶段拷贝编译好的二进制文件
COPY --from=builder /app/main .
COPY --from=builder /app/seed .

EXPOSE 8080
CMD ["./main"]
