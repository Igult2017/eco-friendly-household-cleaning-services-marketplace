-- Add missing provider notification types to the enum
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'provider_rejected';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'provider_unsuspended';
