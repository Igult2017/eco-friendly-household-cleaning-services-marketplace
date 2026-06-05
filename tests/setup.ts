// Stub all external services so unit tests never hit the network
process.env.STRIPE_SECRET_KEY = "sk_test_stub"
process.env.UPSTASH_REDIS_REST_URL = "https://stub.upstash.io"
process.env.UPSTASH_REDIS_REST_TOKEN = "stub_token"
process.env.DATABASE_URL = "postgresql://stub:stub@localhost:5432/stub"
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000"
process.env.PLATFORM_FEE_PERCENT = "15"
process.env.R2_PUBLIC_URL = "https://pub.r2.dev"
process.env.ADMIN_EMAIL = "admin@dorix.eu"
