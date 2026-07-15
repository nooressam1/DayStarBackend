export interface orders {
    id: string;
    order_number: number;
    user_id: string;
    address_id: string;
    status: string;
    total: number;
    created_at: string;
    full_name?: string;
    phone_number?: string;
}