# Staging environment configuration

environment = "staging"

# Scaling
enable_autoscaling = true
min_capacity       = 1
max_capacity       = 4
cpu_scale_target   = 80
memory_scale_target = 85

# Rate limiting (relaxed for testing)
rate_limit_max_requests = 500
rate_limit_window_ms    = 60000

# Logging
log_level = "debug"
