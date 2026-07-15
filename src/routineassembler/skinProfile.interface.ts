export interface SkinProfile {
    id: string;
    created_at: string;
    user_id: string | null;
    skin_type: string;
    concern: string[];
    sensitivity: string;
}