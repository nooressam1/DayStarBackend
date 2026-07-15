import { Injectable, BadRequestException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@Injectable()
export class AddressesService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async getAddresses(userId: string) {
    const { data, error } = await this.supabaseService.admin
      .from('addresses')
      .select('*')
      .eq('user_id', userId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      throw new InternalServerErrorException(`Failed to fetch addresses: ${error.message}`);
    }
    return (data || []).filter(addr => addr.label !== '_deleted_');
  }

  private parseStreet(streetStr: string) {
    let street = streetStr;
    let area = '';
    let governorate = '';
    let postalCode = '';

    const newFormatMatch = streetStr.match(/^(.*?)\s*\(Area:\s*([^\)]*)\)\s*\(Gov:\s*([^\)]*)\)\s*\(Postal:\s*([^\)]*)\)$/);
    const oldFormatMatch = streetStr.match(/^(.*?)\s*\(Area:\s*([^\)]*)\)$/);

    if (newFormatMatch) {
      street = newFormatMatch[1].trim();
      area = newFormatMatch[2].trim();
      governorate = newFormatMatch[3].trim();
      postalCode = newFormatMatch[4].trim();
    } else if (oldFormatMatch) {
      street = oldFormatMatch[1].trim();
      area = oldFormatMatch[2].trim();
    }

    return { street, area, governorate, postalCode };
  }

  private serializeStreet(street: string, area: string, governorate: string, postalCode: string) {
    return `${street} (Area: ${area}) (Gov: ${governorate}) (Postal: ${postalCode || '-'})`;
  }

  async createAddress(userId: string, dto: CreateAddressDto) {
    // Limit to max 6 saved addresses (excluding soft-deleted ones)
    const { data: activeAddresses, error: countError } = await this.supabaseService.admin
      .from('addresses')
      .select('id, label')
      .eq('user_id', userId);

    if (countError) {
      throw new BadRequestException(`Failed to check address limit: ${countError.message}`);
    }

    const activeCount = (activeAddresses || []).filter(a => a.label !== '_deleted_').length;

    if (activeCount >= 6) {
      throw new BadRequestException('Maximum limit of 6 saved addresses reached. Please delete an address before adding a new one.');
    }

    // If setting as default, clear other default addresses first
    if (dto.is_default) {
      await this.clearDefaults(userId);
    }

    const formattedStreet = this.serializeStreet(dto.street, dto.area, dto.governorate, dto.postalCode || '-');

    const { data, error } = await this.supabaseService.admin
      .from('addresses')
      .insert({
        user_id: userId,
        street: formattedStreet,
        building_no: dto.building_no,
        city: dto.city,
        country: dto.country || 'Egypt',
        label: dto.label || null,
        is_default: !!dto.is_default,
      })
      .select()
      .single();

    if (error) {
      throw new BadRequestException(`Failed to create address: ${error.message}`);
    }
    return data;
  }

  async updateAddress(userId: string, addressId: string, dto: UpdateAddressDto) {
    // If setting as default, clear other default addresses first
    if (dto.is_default) {
      await this.clearDefaults(userId);
    }

    let finalStreet: string | undefined = undefined;
    if (dto.street !== undefined || dto.area !== undefined || dto.governorate !== undefined || dto.postalCode !== undefined) {
      const { data: existing } = await this.supabaseService.admin
        .from('addresses')
        .select('street')
        .eq('id', addressId)
        .eq('user_id', userId)
        .single();
      
      const current = this.parseStreet(existing?.street || '');
      const newStreet = dto.street !== undefined ? dto.street : current.street;
      const newArea = dto.area !== undefined ? dto.area : current.area;
      const newGov = dto.governorate !== undefined ? dto.governorate : current.governorate;
      const newPostal = dto.postalCode !== undefined ? dto.postalCode : current.postalCode;
      
      finalStreet = this.serializeStreet(newStreet, newArea, newGov, newPostal);
    }

    const updatePayload: any = {};
    if (finalStreet !== undefined) updatePayload.street = finalStreet;
    if (dto.building_no !== undefined) updatePayload.building_no = dto.building_no;
    if (dto.city !== undefined) updatePayload.city = dto.city;
    if (dto.country !== undefined) updatePayload.country = dto.country;
    if (dto.label !== undefined) updatePayload.label = dto.label;
    if (dto.is_default !== undefined) updatePayload.is_default = dto.is_default;

    const { data, error } = await this.supabaseService.admin
      .from('addresses')
      .update(updatePayload)
      .eq('id', addressId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      throw new BadRequestException(`Failed to update address: ${error.message}`);
    }
    if (!data) {
      throw new NotFoundException(`Address with ID "${addressId}" not found`);
    }
    return data;
  }

  async deleteAddress(userId: string, addressId: string) {
    const { data: addressToDelete, error: fetchError } = await this.supabaseService.admin
      .from('addresses')
      .select('is_default')
      .eq('id', addressId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !addressToDelete) {
      throw new NotFoundException(`Address with ID "${addressId}" not found`);
    }

    // Query orders linked to this address
    const { data: linkedOrders, error: ordersError } = await this.supabaseService.admin
      .from('orders')
      .select('id, status')
      .eq('address_id', addressId);

    if (ordersError) {
      throw new BadRequestException(`Failed to check linked orders: ${ordersError.message}`);
    }

    const activeOrders = (linkedOrders || []).filter(
      (o) => o.status !== 'confirmed' && o.status !== 'cancelled'
    );

    if (activeOrders.length > 0) {
      throw new BadRequestException('This address cannot be deleted because it is linked to active/pending orders.');
    }

    // If it is linked to past orders (confirmed or cancelled), soft-delete it by marking label as '_deleted_'
    if (linkedOrders && linkedOrders.length > 0) {
      const { error: updateError } = await this.supabaseService.admin
        .from('addresses')
        .update({ label: '_deleted_', is_default: false })
        .eq('id', addressId)
        .eq('user_id', userId);

      if (updateError) {
        throw new BadRequestException(`Failed to delete address: ${updateError.message}`);
      }
    } else {
      // If not linked to any orders, physically delete the row from the database
      const { error: deleteError } = await this.supabaseService.admin
        .from('addresses')
        .delete()
        .eq('id', addressId)
        .eq('user_id', userId);

      if (deleteError) {
        throw new BadRequestException(`Failed to delete address: ${deleteError.message}`);
      }
    }

    // If the deleted address was default, set another address as default if any exists
    if (addressToDelete.is_default) {
      const remaining = await this.supabaseService.admin
        .from('addresses')
        .select('id, label')
        .eq('user_id', userId);
      
      const activeRemaining = (remaining.data || []).filter(a => a.label !== '_deleted_');
      
      if (activeRemaining.length > 0) {
        await this.supabaseService.admin
          .from('addresses')
          .update({ is_default: true })
          .eq('id', activeRemaining[0].id);
      }
    }

    return { success: true };
  }

  async setDefaultAddress(userId: string, addressId: string) {
    await this.clearDefaults(userId);

    const { data, error } = await this.supabaseService.admin
      .from('addresses')
      .update({ is_default: true })
      .eq('id', addressId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      throw new BadRequestException(`Failed to set default address: ${error.message}`);
    }
    if (!data) {
      throw new NotFoundException(`Address with ID "${addressId}" not found`);
    }
    return data;
  }

  private async clearDefaults(userId: string) {
    const { error } = await this.supabaseService.admin
      .from('addresses')
      .update({ is_default: false })
      .eq('user_id', userId);
    
    if (error) {
      throw new InternalServerErrorException(`Failed to clear default addresses: ${error.message}`);
    }
  }
}
