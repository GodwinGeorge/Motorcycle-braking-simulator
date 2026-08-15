FROM git as fetch_base

# Build stage
FROM ubuntu:22.04 AS builder
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential cmake git ca-certificates wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /src
# Copy project
COPY . /src

# Create build and build the server target
RUN mkdir -p build && cd build && cmake .. -DCMAKE_BUILD_TYPE=Release && cmake --build . --parallel --target cpp_server

# Runtime stage
FROM ubuntu:22.04
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /src/build/cpp_server ./cpp_server
COPY --from=builder /src/web ./web
EXPOSE 18080
CMD ["./cpp_server"]
