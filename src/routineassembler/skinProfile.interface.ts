export interface SkinProfile {
    id: string;
    created_at: string;
    user_id: string | null;
    skinType: 'oily' | 'dry' | 'combination' | 'normal' | 'sensitive';
    concern: string[];
    sensitivity: string;
    sunExposure?: string;
}