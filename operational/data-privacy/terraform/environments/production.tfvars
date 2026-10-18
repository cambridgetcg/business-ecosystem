# Production environment configuration

environment = "production"

# Scaling
enable_autoscaling = true
min_capacity       = 2
max_capacity       = 8
cpu_scale_target   = 70
memory_scale_target = 75

# Rate limiting (production limits)
rate_limit_max_requests = 200
rate_limit_window_ms    = 60000

# Logging
log_level = "info"
