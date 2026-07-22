import { supabase } from '../supabase';
import { ReservationDetails, VehicleInspection, Payment, ProtectionAssurance } from '../types';

// Mappe un forfait d'assurance de protection embarqué (avec ses items + statut).
function mapProtectionAssurance(pa: any): ProtectionAssurance | undefined {
  if (!pa) return undefined;
  return {
    id: pa.id,
    name: pa.name,
    pricePerDay: Math.round(Number(pa.price_per_day) || 0),
    isActive: pa.is_active,
    createdAt: pa.created_at,
    items: (pa.protection_assurance_item_links || [])
      .map((link: any) => ({
        linkId: link.id,
        itemId: link.item?.id || null,
        name: link.item?.item_name || '',
        status: !!link.status,
        displayOrder: link.item?.display_order ?? 0,
      }))
      .sort((x: any, y: any) => (x.displayOrder ?? 0) - (y.displayOrder ?? 0)),
  };
}

// =========================================
// RESERVATIONS SERVICE
// =========================================
export class ReservationsService {
  // ========== RESERVATIONS ==========
  
  static async createReservation(data: {
    clientId: string;
    carId: string;
    departureDate: string;
    departureTime: string;
    departureAgencyId: string;
    returnDate: string;
    returnTime: string;
    returnAgencyId: string;
    pricePerDay: number;
    priceWeek?: number;
    priceMonth?: number;
    totalDays: number;
    totalPrice: number;
    deposit: number;
    discountAmount?: number;
    discountType?: 'percentage' | 'fixed';
    advancePayment?: number;
    remainingPayment: number;
    notes?: string;
    status?: string;
    cautionAmountDzd?: number;
    cautionCurrency?: 'DZD' | 'EUR';
    euroRate?: number;
    assuranceEnabled?: boolean;
    assurancePercentage?: number;
    protectionAssuranceId?: string | null;
    protectionAssuranceName?: string | null;
    protectionAssurancePrice?: number | null;
    createdBy?: string;
    createdByName?: string;
    // Origine : 'agency' (créée par l'admin, défaut) ou 'website' (site public).
    source?: 'website' | 'agency';
  }): Promise<{ id: string }> {
    const { data: reservation, error } = await supabase
      .from('reservations')
      .insert([{
        client_id: data.clientId,
        car_id: data.carId,
        departure_date: data.departureDate,
        departure_time: data.departureTime,
        departure_agency_id: data.departureAgencyId,
        return_date: data.returnDate,
        return_time: data.returnTime,
        return_agency_id: data.returnAgencyId,
        price_per_day: data.pricePerDay,
        price_week: data.priceWeek,
        price_month: data.priceMonth,
        total_days: data.totalDays,
        total_price: data.totalPrice,
        deposit: data.deposit,
        discount_amount: data.discountAmount || 0,
        discount_type: data.discountType,
        advance_payment: data.advancePayment || 0,
        remaining_payment: data.remainingPayment,
        status: data.status || 'pending',
        notes: data.notes,
        caution_amount_dzd: data.cautionAmountDzd || data.deposit,
        caution_currency: data.cautionCurrency || 'DZD',
        euro_rate: data.euroRate || 145,
        assurance_enabled: data.assuranceEnabled || false,
        assurance_percentage: data.assurancePercentage || null,
        protection_assurance_id: data.protectionAssuranceId || null,
        protection_assurance_name: data.protectionAssuranceName || null,
        protection_assurance_price: data.protectionAssurancePrice || 0,
        created_by: data.createdBy || null,
        created_by_name: data.createdByName || null,
        // Réservations créées ici = origine agence par défaut. Marquée
        // explicitement pour que le planificateur affiche « 🏢 Agence ».
        source: data.source || 'agency',
      }])
      .select()
      .single();

    if (error) throw error;
    return { id: reservation.id };
  }

  static async addCautionAmountDzdColumn(): Promise<void> {
    try {
      // This is a helper to ensure the column exists
      // In production, this should be run as a migration
      const { error } = await supabase.rpc('exec', {
        sql: 'ALTER TABLE reservations ADD COLUMN IF NOT EXISTS caution_amount_dzd NUMERIC'
      }).catch(() => ({ error: null })); // Silently fail if column already exists
    } catch (e) {
      // Silently fail - column might already exist
    }
  }

  static async getReservations(filters?: {
    status?: string;
    clientId?: string;
    carId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<ReservationDetails[]> {
    let query = supabase
      .from('reservations')
      .select(`
        *,
        client:clients(*),
        car:cars(*),
        departure_agency:agencies!reservations_departure_agency_fkey(*),
        return_agency:agencies!reservations_return_agency_fkey(*),
        vehicle_inspections(
          *,
          inspection_responses(
            *,
            checklist_item:inspection_checklist_items(*)
          )
        ),
        reservation_services(*),
        payments(*),
        protection_assurance:protection_assurances!reservations_protection_assurance_fkey(
          id, name, price_per_day, is_active, created_at,
          protection_assurance_item_links(
            id, status, item:protection_assurance_items(id, item_name, display_order)
          )
        )
      `);

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.clientId) {
      query = query.eq('client_id', filters.clientId);
    }
    if (filters?.carId) {
      query = query.eq('car_id', filters.carId);
    }
    if (filters?.startDate) {
      query = query.gte('departure_date', filters.startDate);
    }
    if (filters?.endDate) {
      query = query.lte('return_date', filters.endDate);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching reservations:', error);
      throw error;
    }

    // Debug: Log raw data to check if creator fields exist
    if (data && data.length > 0) {
      console.log('📦 Raw reservation data from DB (first item):', {
        id: data[0].id,
        created_by: data[0].created_by,
        created_by_name: data[0].created_by_name,
        allKeys: Object.keys(data[0])
      });
    }

    return (data || []).map(res => ({
      id: res.id,
      clientId: res.client_id,
      departure_agency_id: res.departure_agency_id,
      return_agency_id: res.return_agency_id,
      client: res.client ? {
        id: res.client.id,
        firstName: res.client.first_name || res.client.firstName,
        lastName: res.client.last_name || res.client.lastName,
        phone: res.client.phone,
        email: res.client.email,
        dateOfBirth: res.client.date_of_birth || res.client.dateOfBirth,
        placeOfBirth: res.client.place_of_birth || res.client.placeOfBirth,
        profilePhoto: res.client.profile_photo || res.client.profilePhoto,
        wilaya: res.client.wilaya,
        completeAddress: res.client.complete_address || res.client.completeAddress,
        idCardNumber: res.client.id_card_number || res.client.idCardNumber,
        licenseNumber: res.client.license_number || res.client.licenseNumber,
        licenseExpirationDate: res.client.license_expiration_date || res.client.licenseExpirationDate,
        licenseDeliveryDate: res.client.license_delivery_date || res.client.licenseDeliveryDate,
        licenseDeliveryPlace: res.client.license_delivery_place || res.client.licenseDeliveryPlace,
        documentType: res.client.document_type || res.client.documentType,
        documentNumber: res.client.document_number || res.client.documentNumber,
        documentDeliveryDate: res.client.document_delivery_date || res.client.documentDeliveryDate,
        documentExpirationDate: res.client.document_expiration_date || res.client.documentExpirationDate,
        documentDeliveryAddress: res.client.document_delivery_address || res.client.documentDeliveryAddress,
        createdAt: res.client.created_at,
      } : null,
      carId: res.car_id,
      car: res.car ? {
        id: res.car.id,
        brand: res.car.brand,
        model: res.car.model,
        registration: res.car.plate_number || res.car.registration,
        year: res.car.year,
        color: res.car.color,
        energy: res.car.energy,
        transmission: res.car.transmission,
        seats: res.car.seats,
        doors: res.car.doors,
        priceDay: res.car.price_per_day,
        priceWeek: res.car.price_week,
        priceMonth: res.car.price_month,
        deposit: res.car.deposit,
        images: res.car.image_url ? [res.car.image_url] : [],
        mileage: res.car.mileage,
        vin: res.car.vin,
      } : null,
      step1: {
        carId: res.car_id,
        departureDate: res.departure_date,
        departureTime: res.departure_time,
        departureAgency: res.departure_agency_id,
        returnDate: res.return_date,
        returnTime: res.return_time,
        returnAgency: res.return_agency_id,
        differentReturnAgency: res.departure_agency_id !== res.return_agency_id,
      },
      step2: {
        firstName: res.client?.first_name || res.client?.firstName || '',
        lastName: res.client?.last_name || res.client?.lastName || '',
        phone: res.client?.phone || '',
        email: res.client?.email || '',
        dateOfBirth: res.client?.dateOfBirth,
        placeOfBirth: res.client?.placeOfBirth,
        licenseNumber: res.client?.licenseNumber || '',
        licenseExpiration: res.client?.licenseExpirationDate,
        licenseDelivery: res.client?.licenseDeliveryDate,
        licenseDeliveryPlace: res.client?.licenseDeliveryPlace,
        additionalDocType: res.client?.documentType === 'none' ? undefined : (res.client?.documentType as any),
        additionalDocNumber: res.client?.documentNumber,
        additionalDocDelivery: res.client?.documentDeliveryDate,
        additionalDocExpiration: res.client?.documentExpirationDate,
        additionalDocDeliveryAddress: res.client?.documentDeliveryAddress,
        wilaya: res.client?.wilaya || '',
        completeAddress: res.client?.completeAddress,
        scannedDocuments: res.client?.scannedDocuments,
        photo: res.client?.profilePhoto,
      },
      totalDays: res.total_days,
      totalPrice: res.total_price,
      deposit: res.deposit,
      discountAmount: res.discount_amount || 0,
      discountType: res.discount_type,
      advancePayment: res.advance_payment || 0,
      remainingPayment: res.remaining_payment,
      tvaApplied: res.tva_applied || false,
      additionalFees: res.additional_fees || 0,
      status: res.status,
      notes: res.notes,
      conditions: res.conditions_text,
      createdAt: res.created_at,
      activatedAt: res.activated_at,
      completedAt: res.completed_at,
      // Caution and Assurance fields
      cautionAmountDzd: res.caution_amount_dzd || res.deposit,
      cautionCurrency: res.caution_currency || 'DZD',
      euroRate: res.euro_rate || 145,
      assuranceEnabled: res.assurance_enabled || false,
      assurancePercentage: res.assurance_percentage,
      // Forfait d'assurance de protection sélectionné
      protectionAssuranceId: res.protection_assurance_id || undefined,
      protectionAssuranceName: res.protection_assurance_name || undefined,
      protectionAssurancePrice: res.protection_assurance_price != null ? Number(res.protection_assurance_price) : undefined,
      protectionAssurance: mapProtectionAssurance(res.protection_assurance),
      departureInspection: (() => {
        const departureInspections = res.vehicle_inspections?.filter((i: any) => i.type === 'departure') || [];
        if (departureInspections.length === 0) return undefined;
        const latest = departureInspections.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
        return {
          id: latest.id,
          reservationId: latest.reservation_id,
          type: latest.type,
          mileage: latest.mileage,
          fuelLevel: latest.fuel_level,
          location: res.departure_agency?.name || latest.agency_id || '',
          date: latest.date,
          time: latest.time,
          interiorPhotos: latest.interior_photo ? [latest.interior_photo] : [],
          exteriorPhotos: [
            latest.exterior_front_photo,
            latest.exterior_rear_photo,
            ...(latest.other_photos || []),
          ].filter(Boolean),
          inspectionItems: (latest.inspection_responses || []).map((resp: any) => ({
            id: resp.checklist_item?.id || resp.checklist_item_id,
            responseId: resp.id,
            name: resp.checklist_item?.item_name || '',
            checked: resp.status,
            category: resp.checklist_item?.category === 'securite' ? 'security' :
                     resp.checklist_item?.category === 'equipements' ? 'equipment' :
                     resp.checklist_item?.category === 'confort' ? 'comfort' : 'cleanliness'
          })),
          notes: latest.notes,
          createdAt: latest.created_at,
          signature: latest.client_signature
        };
      })(),
      returnInspection: (() => {
        const returnInspections = res.vehicle_inspections?.filter((i: any) => i.type === 'return') || [];
        if (returnInspections.length === 0) return undefined;
        const latest = returnInspections.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
        return {
          id: latest.id,
          reservationId: latest.reservation_id,
          type: latest.type,
          mileage: latest.mileage,
          fuelLevel: latest.fuel_level,
          location: res.return_agency?.name || latest.agency_id || '',
          date: latest.date,
          time: latest.time,
          interiorPhotos: latest.interior_photo ? [latest.interior_photo] : [],
          exteriorPhotos: [
            latest.exterior_front_photo,
            latest.exterior_rear_photo,
            ...(latest.other_photos || []),
          ].filter(Boolean),
          inspectionItems: (latest.inspection_responses || []).map((resp: any) => ({
            id: resp.checklist_item?.id || resp.checklist_item_id,
            responseId: resp.id,
            name: resp.checklist_item?.item_name || '',
            checked: resp.status,
            category: resp.checklist_item?.category === 'securite' ? 'security' :
                     resp.checklist_item?.category === 'equipements' ? 'equipment' :
                     resp.checklist_item?.category === 'confort' ? 'comfort' : 'cleanliness'
          })),
          notes: latest.notes,
          createdAt: latest.created_at,
          signature: latest.client_signature
        };
      })(),
      additionalServices: res.reservation_services || [],
      payments: res.payments || [],
      excessMileage: res.excess_mileage,
      missingFuel: res.missing_fuel,
      createdBy: res.created_by,
      createdByName: res.created_by_name,
      // Origine : 'website' (site public) ou 'agency' (admin, défaut).
      // Colonne ajoutée par la migration 20260708_reservation_source.sql ;
      // absente = ancienne base → traitée comme 'agency'.
      source: (res.source === 'website' ? 'website' : 'agency') as 'website' | 'agency',
    })).map(mapped => {
      console.log('✅ Mapped reservation:', {
        id: mapped.id,
        createdBy: mapped.createdBy,
        createdByName: mapped.createdByName
      });
      return mapped;
    });
  }

  static async getReservationById(id: string): Promise<ReservationDetails> {
    const { data, error } = await supabase
      .from('reservations')
      .select(`
        *,
        client:clients(*),
        car:cars(*),
        departure_agency:agencies!reservations_departure_agency_fkey(*),
        return_agency:agencies!reservations_return_agency_fkey(*),
        vehicle_inspections(
          *,
          inspection_responses(
            *,
            checklist_item:inspection_checklist_items(*)
          )
        ),
        reservation_services(*),
        payments(*),
        protection_assurance:protection_assurances!reservations_protection_assurance_fkey(
          id, name, price_per_day, is_active, created_at,
          protection_assurance_item_links(
            id, status, item:protection_assurance_items(id, item_name, display_order)
          )
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    return {
      id: data.id,
      clientId: data.client_id,
      client: data.client ? {
        id: data.client.id,
        firstName: data.client.first_name || data.client.firstName,
        lastName: data.client.last_name || data.client.lastName,
        phone: data.client.phone,
        email: data.client.email,
        profilePhoto: data.client.profile_photo || data.client.profilePhoto,
        dateOfBirth: data.client.date_of_birth || data.client.dateOfBirth,
        placeOfBirth: data.client.place_of_birth || data.client.placeOfBirth,
        wilaya: data.client.wilaya,
        completeAddress: data.client.complete_address || data.client.completeAddress,
        idCardNumber: data.client.id_card_number || data.client.idCardNumber,
        licenseNumber: data.client.license_number || data.client.licenseNumber,
        licenseExpirationDate: data.client.license_expiration_date || data.client.licenseExpirationDate,
        licenseDeliveryDate: data.client.license_delivery_date || data.client.licenseDeliveryDate,
        licenseDeliveryPlace: data.client.license_delivery_place || data.client.licenseDeliveryPlace,
        documentType: data.client.document_type || data.client.documentType,
        documentNumber: data.client.document_number || data.client.documentNumber,
        documentDeliveryDate: data.client.document_delivery_date || data.client.documentDeliveryDate,
        documentExpirationDate: data.client.document_expiration_date || data.client.documentExpirationDate,
        documentDeliveryAddress: data.client.document_delivery_address || data.client.documentDeliveryAddress,
        createdAt: data.client.created_at,
      } : null,
      carId: data.car_id,
      car: data.car ? {
        id: data.car.id,
        brand: data.car.brand,
        model: data.car.model,
        registration: data.car.plate_number || data.car.registration,
        year: data.car.year,
        color: data.car.color,
        energy: data.car.energy,
        transmission: data.car.transmission,
        seats: data.car.seats,
        doors: data.car.doors,
        priceDay: data.car.price_per_day,
        priceWeek: data.car.price_week,
        priceMonth: data.car.price_month,
        deposit: data.car.deposit,
        images: data.car.image_url ? [data.car.image_url] : [],
        mileage: data.car.mileage,
        vin: data.car.vin,
      } : null,
      step1: {
        carId: data.car_id,
        departureDate: data.departure_date,
        departureTime: data.departure_time,
        departureAgency: data.departure_agency_id,
        returnDate: data.return_date,
        returnTime: data.return_time,
        returnAgency: data.return_agency_id,
        differentReturnAgency: data.departure_agency_id !== data.return_agency_id,
      },
      step2: {
        firstName: data.client?.first_name || data.client?.firstName || '',
        lastName: data.client?.last_name || data.client?.lastName || '',
        phone: data.client?.phone || '',
        email: data.client?.email || '',
        dateOfBirth: data.client?.date_of_birth || data.client?.dateOfBirth,
        placeOfBirth: data.client?.place_of_birth || data.client?.placeOfBirth,
        licenseNumber: data.client?.license_number || data.client?.licenseNumber || '',
        licenseExpiration: data.client?.license_expiration_date || data.client?.licenseExpirationDate,
        licenseDelivery: data.client?.license_delivery_date || data.client?.licenseDeliveryDate,
        licenseDeliveryPlace: data.client?.license_delivery_place || data.client?.licenseDeliveryPlace,
        additionalDocType: (data.client?.document_type || data.client?.documentType) === 'none' ? undefined : (data.client?.document_type || data.client?.documentType),
        additionalDocNumber: data.client?.document_number || data.client?.additionalDocNumber,
        additionalDocDelivery: data.client?.document_delivery_date || data.client?.additionalDocDelivery,
        additionalDocExpiration: data.client?.document_expiration_date || data.client?.additionalDocExpiration,
        additionalDocDeliveryAddress: data.client?.document_delivery_address || data.client?.additionalDocDeliveryAddress,
        wilaya: data.client?.wilaya || '',
        completeAddress: data.client?.complete_address || data.client?.completeAddress,
        scannedDocuments: data.client?.scanned_documents || data.client?.scannedDocuments,
        photo: data.client?.profile_photo || data.client?.profilePhoto,
      },
      additionalServices: data.reservation_services || [],
      payments: data.payments || [],
      excessMileage: data.excess_mileage,
      missingFuel: data.missing_fuel,
      additionalFees: data.additional_fees || 0,
      tvaApplied: data.tva_applied || false,
      deposit: data.deposit,
      totalDays: data.total_days,
      totalPrice: data.total_price,
      discountAmount: data.discount_amount || 0,
      discountType: data.discount_type,
      advancePayment: data.advance_payment || 0,
      remainingPayment: data.remaining_payment,
      status: data.status,
      createdAt: data.created_at,
      activatedAt: data.activated_at,
      completedAt: data.completed_at,
      notes: data.notes,
      conditions: data.conditions_text,
      assuranceEnabled: data.assurance_enabled || false,
      assurancePercentage: data.assurance_percentage,
      protectionAssuranceId: data.protection_assurance_id || undefined,
      protectionAssuranceName: data.protection_assurance_name || undefined,
      protectionAssurancePrice: data.protection_assurance_price != null ? Number(data.protection_assurance_price) : undefined,
      protectionAssurance: mapProtectionAssurance(data.protection_assurance),
      departureInspection: (() => {
        // Get latest departure inspection (most recent by created_at)
        const departureInspections = data.vehicle_inspections?.filter((i: any) => i.type === 'departure') || [];
        if (departureInspections.length === 0) return undefined;
        const latest = departureInspections.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
        return {
          id: latest.id,
          reservationId: latest.reservation_id,
          type: latest.type,
          mileage: latest.mileage,
          fuelLevel: latest.fuel_level,
          location: latest.agency_id || '',
          date: latest.date,
          time: latest.time,
          interiorPhotos: latest.interior_photo ? [latest.interior_photo] : [],
          exteriorPhotos: [
            latest.exterior_front_photo,
            latest.exterior_rear_photo,
            ...(latest.other_photos || []),
          ].filter(Boolean),
          inspectionItems: (latest.inspection_responses || []).map((resp: any) => ({
            id: resp.checklist_item?.id || resp.checklist_item_id,
            responseId: resp.id,
            name: resp.checklist_item?.item_name || '',
            checked: resp.status,
            category: resp.checklist_item?.category === 'securite' ? 'security' :
                     resp.checklist_item?.category === 'equipements' ? 'equipment' :
                     resp.checklist_item?.category === 'confort' ? 'comfort' : 'cleanliness'
          })),
          notes: latest.notes,
          createdAt: latest.created_at,
          signature: latest.client_signature
        };
      })(),
      returnInspection: (() => {
        // Get latest return inspection (most recent by created_at)
        const returnInspections = data.vehicle_inspections?.filter((i: any) => i.type === 'return') || [];
        if (returnInspections.length === 0) return undefined;
        const latest = returnInspections.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
        return {
          id: latest.id,
          reservationId: latest.reservation_id,
          type: latest.type,
          mileage: latest.mileage,
          fuelLevel: latest.fuel_level,
          location: latest.agency_id || '',
          date: latest.date,
          time: latest.time,
          interiorPhotos: latest.interior_photo ? [latest.interior_photo] : [],
          exteriorPhotos: [
            latest.exterior_front_photo,
            latest.exterior_rear_photo,
            ...(latest.other_photos || []),
          ].filter(Boolean),
          inspectionItems: (latest.inspection_responses || []).map((resp: any) => ({
            id: resp.checklist_item?.id || resp.checklist_item_id,
            responseId: resp.id,
            name: resp.checklist_item?.item_name || '',
            checked: resp.status,
            category: resp.checklist_item?.category === 'securite' ? 'security' :
                     resp.checklist_item?.category === 'equipements' ? 'equipment' :
                     resp.checklist_item?.category === 'confort' ? 'comfort' : 'cleanliness'
          })),
          notes: latest.notes,
          createdAt: latest.created_at,
          signature: latest.client_signature
        };
      })(),
      createdBy: data.created_by,
      createdByName: data.created_by_name,
      source: (data.source === 'website' ? 'website' : 'agency') as 'website' | 'agency',
    };
  }

  static async updateReservation(id: string, updates: Partial<{
    carId: string;
    clientId: string;
    departureDate: string;
    returnDate: string;
    departureTime: string;
    returnTime: string;
    totalDays: number;
    status: string;
    discountAmount: number;
    discountType: string;
    advancePayment: number;
    remainingPayment: number;
    notes: string;
    conditionsText?: string;
    tvaApplied: boolean;
    tvaAmount: number;
    additionalFees: number;
    totalPrice: number;
    deposit: number;
    activatedAt?: string;
    completedAt?: string;
    cautionAmountDzd: number;
    cautionCurrency: 'DZD' | 'EUR';
    euroRate: number;
    assuranceEnabled: boolean;
    assurancePercentage: number;
    protectionAssuranceId: string | null;
    protectionAssuranceName: string | null;
    protectionAssurancePrice: number | null;
  }>): Promise<void> {
    const updateData: any = {};

    // Only include fields that are actually provided
    // Booking details
    if (updates.carId !== undefined) updateData.car_id = updates.carId;
    if (updates.clientId !== undefined) updateData.client_id = updates.clientId;
    if (updates.departureDate !== undefined) updateData.departure_date = updates.departureDate;
    if (updates.returnDate !== undefined) updateData.return_date = updates.returnDate;
    if (updates.departureTime !== undefined) updateData.departure_time = updates.departureTime;
    if (updates.returnTime !== undefined) updateData.return_time = updates.returnTime;
    if (updates.totalDays !== undefined) updateData.total_days = updates.totalDays;
    
    // Status & Financial fields
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.discountAmount !== undefined) updateData.discount_amount = updates.discountAmount;
    if (updates.discountType !== undefined) updateData.discount_type = updates.discountType;
    if (updates.advancePayment !== undefined) updateData.advance_payment = updates.advancePayment;
    if (updates.remainingPayment !== undefined) updateData.remaining_payment = updates.remainingPayment;
    if (updates.notes !== undefined) updateData.notes = updates.notes;
    if (updates.conditionsText !== undefined) updateData.conditions_text = updates.conditionsText;
    if (updates.tvaApplied !== undefined) updateData.tva_applied = updates.tvaApplied;
    if (updates.tvaAmount !== undefined) updateData.tva_amount = updates.tvaAmount;
    if (updates.additionalFees !== undefined) updateData.additional_fees = updates.additionalFees;
    if (updates.totalPrice !== undefined) updateData.total_price = updates.totalPrice;
    if (updates.deposit !== undefined) updateData.deposit = updates.deposit;
    if (updates.activatedAt !== undefined) updateData.activated_at = updates.activatedAt;
    if (updates.completedAt !== undefined) updateData.completed_at = updates.completedAt;
    // Caution and Assurance fields
    if (updates.cautionAmountDzd !== undefined) updateData.caution_amount_dzd = updates.cautionAmountDzd;
    if (updates.cautionCurrency !== undefined) updateData.caution_currency = updates.cautionCurrency;
    if (updates.euroRate !== undefined) updateData.euro_rate = updates.euroRate;
    if (updates.assuranceEnabled !== undefined) updateData.assurance_enabled = updates.assuranceEnabled;
    if (updates.assurancePercentage !== undefined) updateData.assurance_percentage = updates.assurancePercentage;
    if (updates.protectionAssuranceId !== undefined) updateData.protection_assurance_id = updates.protectionAssuranceId;
    if (updates.protectionAssuranceName !== undefined) updateData.protection_assurance_name = updates.protectionAssuranceName;
    if (updates.protectionAssurancePrice !== undefined) updateData.protection_assurance_price = updates.protectionAssurancePrice;

    // Remove caution_amount_dzd from updateData if it exists and is invalid, as it may not exist in the schema yet
    // The column should be added via migration first
    try {
      const { error } = await supabase
        .from('reservations')
        .update(updateData)
        .eq('id', id);

      if (error) {
        // If the error is about caution_amount_dzd column not existing, retry without it
        if (error.message && error.message.includes('caution_amount_dzd')) {
          delete updateData.caution_amount_dzd;
          const { error: retryError } = await supabase
            .from('reservations')
            .update(updateData)
            .eq('id', id);
          if (retryError) throw retryError;
        } else {
          throw error;
        }
      }
    } catch (e) {
      throw e;
    }
  }

  static async activateReservation(id: string): Promise<void> {
    const { error } = await supabase
      .from('reservations')
      .update({
        status: 'active',
        activated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;
  }

  static async activateReservationWithInspection(data: {
    reservationId: string;
    carId: string;
    mileage: number;
    fuelLevel: 'full' | 'half' | 'quarter' | 'eighth' | 'empty';
    location: string;
    notes?: string;
    signatureDataUrl?: string;
    departurePhotos?: string[];
    inspectionItems: any[];
    departureAgencyId?: string;
  }): Promise<void> {
    // First activate the reservation
    await this.activateReservation(data.reservationId);

    // Check if departure inspection already exists for this reservation
    try {
      const { data: existingInspection, error } = await supabase
        .from('vehicle_inspections')
        .select('id')
        .eq('reservation_id', data.reservationId)
        .eq('type', 'departure')
        .single();

      if (existingInspection) {
        // Inspection already exists, skip creation to avoid 409 conflict
        console.log('Departure inspection already exists for this reservation');
        return;
      }
    } catch (e) {
      // No existing inspection, continue with creation
      console.log('No existing departure inspection, creating new one');
    }

    // Upload signature if provided
    let signatureUrl = '';
    if (data.signatureDataUrl) {
      const response = await fetch(data.signatureDataUrl);
      const blob = await response.blob();
      const file = new File([blob], `signature-departure-${data.reservationId}-${Date.now()}.png`, { type: 'image/png' });
      signatureUrl = await this.uploadSignature(file, data.reservationId);
    }

    // Upload departure photos if provided
    let photoUrls: string[] = [];
    if (data.departurePhotos && data.departurePhotos.length > 0) {
      for (let i = 0; i < data.departurePhotos.length; i++) {
        const photoDataUrl = data.departurePhotos[i];
        const response = await fetch(photoDataUrl);
        const blob = await response.blob();
        const file = new File([blob], `departure-photo-${data.reservationId}-${i}-${Date.now()}.jpg`, { type: 'image/jpeg' });
        const url = await this.uploadInspectionImage(file, data.reservationId, 'departure');
        photoUrls.push(url);
      }
    }

    // Update car mileage and fuel level
    await supabase
      .from('cars')
      .update({
        mileage: data.mileage,
        energy: data.fuelLevel === 'full' ? 'Plein' : 
                data.fuelLevel === 'half' ? '1/2' :
                data.fuelLevel === 'quarter' ? '1/4' :
                data.fuelLevel === 'eighth' ? '1/8' : 'Vide'
      })
      .eq('id', data.carId);

    // Use agency ID from reservation, fall back to location if not provided
    const agencyId = data.departureAgencyId || data.location || 'default-agency';

    await this.createInspection({
      reservationId: data.reservationId,
      type: 'departure',
      mileage: data.mileage,
      fuelLevel: data.fuelLevel,
      agencyId: agencyId,
      date: new Date().toLocaleDateString(),
      time: new Date().toLocaleTimeString(),
      notes: data.notes,
      exteriorFrontPhotoUrl: photoUrls.length > 0 ? photoUrls[0] : undefined,
      interiorPhotoUrl: photoUrls.length > 1 ? photoUrls[1] : undefined,
      otherPhotosUrls: photoUrls.length > 2 ? photoUrls.slice(2) : [],
      clientSignatureUrl: signatureUrl,
    });

    // Save inspection items if provided
    if (data.inspectionItems && data.inspectionItems.length > 0) {
      const { data: inspection } = await supabase
        .from('vehicle_inspections')
        .select('id')
        .eq('reservation_id', data.reservationId)
        .eq('type', 'departure')
        .single();

      if (inspection) {
        const responses = data.inspectionItems.map((item: any) => ({
          inspection_id: inspection.id,
          checklist_item_id: item.id,
          status: !!item.checked,
          note: item.note || null
        }));
        await supabase.from('inspection_responses').insert(responses);
      }
    }
  }

  static async completeReservationWithInspection(data: {
    reservationId: string;
    carId: string;
    returnMileage: number;
    returnFuelLevel: 'full' | 'half' | 'quarter' | 'eighth' | 'empty';
    returnLocation: string;
    excessMileage?: number;
    missingFuel?: number;
    signatureDataUrl?: string;
    notes?: string;
    inspectionItems: any[];
    returnAgencyId?: string;
  }): Promise<void> {
    try {
      console.log('📋 Starting completion process for reservation:', data.reservationId);

      // Validate inputs
      if (!data.reservationId || !data.carId || data.returnMileage === undefined) {
        throw new Error('Missing required fields: reservationId, carId, or returnMileage');
      }

      console.log('✅ Inputs validated');

      // Upload signature if provided
      let signatureUrl = '';
      if (data.signatureDataUrl) {
        try {
          console.log('📸 Uploading signature...');
          const response = await fetch(data.signatureDataUrl);
          const blob = await response.blob();
          const file = new File([blob], `signature-return-${data.reservationId}-${Date.now()}.png`, { type: 'image/png' });
          signatureUrl = await this.uploadSignature(file, data.reservationId);
          console.log('✅ Signature uploaded');
        } catch (err) {
          console.warn('⚠️ Signature upload failed (non-blocking):', err);
        }
      }

      // Create the return inspection
      console.log('🔍 Creating return inspection...');
      const now = new Date();
      // Format date as YYYY-MM-DD (PostgreSQL expects this format, not DD/MM/YYYY)
      const dateString = now.toISOString().split('T')[0];
      // Format time as HH:MM:SS
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      const timeString = `${hours}:${minutes}:${seconds}`;
      
      const inspectionData = {
        reservationId: data.reservationId,
        type: 'return' as const,
        mileage: data.returnMileage,
        fuelLevel: data.returnFuelLevel,
        agencyId: data.returnAgencyId || data.returnLocation,
        date: dateString,
        time: timeString,
        notes: data.notes,
        clientSignatureUrl: signatureUrl,
      };

      const { id: inspectionId } = await this.createInspection(inspectionData);
      console.log('✅ Return inspection created:', inspectionId);

      // Save inspection responses (checklist items) for return inspection
      if (data.inspectionItems && data.inspectionItems.length > 0) {
        try {
          console.log('📝 Saving inspection responses...');
          const responses = data.inspectionItems.map((item: any) => ({
            inspection_id: inspectionId,
            checklist_item_id: item.id,
            status: !!item.checked,
            note: item.note || null
          }));
          // Use upsert to avoid duplicates
          const { DatabaseService } = await import('./DatabaseService');
          await DatabaseService.upsertInspectionResponses(responses);
          console.log('✅ Inspection responses saved');
        } catch (err) {
          console.warn('⚠️ Failed to save inspection responses (non-blocking):', err);
        }
      }

      // Update the car's mileage
      console.log('🚗 Updating car mileage...');
      const { error: carError } = await supabase
        .from('cars')
        .update({ mileage: data.returnMileage })
        .eq('id', data.carId);

      if (carError) {
        console.error('❌ Car update failed:', carError);
        throw new Error(`Failed to update car mileage: ${carError.message}`);
      }
      console.log('✅ Car mileage updated');

      // Update reservation with completion data
      console.log('📋 Updating reservation status to completed...');
      const updateData: any = {
        status: 'completed',
        completed_at: new Date().toISOString(),
      };

      if (data.excessMileage !== undefined) updateData.excess_mileage = data.excessMileage;
      if (data.missingFuel !== undefined) updateData.missing_fuel = data.missingFuel;
      if (data.notes) updateData.notes = data.notes;

      console.log('Update data:', updateData);

      const { error } = await supabase
        .from('reservations')
        .update(updateData)
        .eq('id', data.reservationId);

      if (error) {
        console.error('❌ Reservation update failed:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        console.error('Error details:', error);
        throw new Error(`Failed to complete reservation: ${error.message}`);
      }

      console.log('✅ Reservation completion successful');
    } catch (error: any) {
      console.error('❌ Error in completeReservationWithInspection:', error);
      console.error('Full error object:', JSON.stringify(error, null, 2));
      throw error;
    }
  }

  static async cancelReservation(id: string): Promise<void> {
    // First, get the reservation to find the car ID
    const { data: reservation, error: fetchError } = await supabase
      .from('reservations')
      .select('car_id')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    // Update reservation status to cancelled
    const { error } = await supabase
      .from('reservations')
      .update({ status: 'cancelled' })
      .eq('id', id);

    if (error) throw error;

    // With period-based availability, we no longer need to update car status globally
    // The car status is no longer used for availability checks - only date overlaps matter
  }

  static async deleteReservation(id: string): Promise<void> {
    // First, get the reservation to find the car ID
    const { data: reservation, error: fetchError } = await supabase
      .from('reservations')
      .select('car_id')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    // Delete the reservation
    const { error } = await supabase
      .from('reservations')
      .delete()
      .eq('id', id);

    if (error) throw error;

    // With period-based availability, we no longer need to update car status globally
    // The car status is no longer used for availability checks - only date overlaps matter
  }

  // ========== VEHICLE INSPECTIONS ==========

  static async createInspection(data: {
    reservationId: string;
    type: 'departure' | 'return';
    mileage: number;
    fuelLevel: 'full' | 'half' | 'quarter' | 'eighth' | 'empty';
    agencyId: string;
    date: string;
    time: string;
    notes?: string;
    exteriorFrontPhotoUrl?: string;
    exteriorRearPhotoUrl?: string;
    interiorPhotoUrl?: string;
    otherPhotosUrls?: string[];
    clientSignatureUrl?: string;
  }): Promise<{ id: string }> {
    const { data: inspection, error } = await supabase
      .from('vehicle_inspections')
      .upsert([{
        reservation_id: data.reservationId,
        type: data.type,
        mileage: data.mileage,
        fuel_level: data.fuelLevel,
        agency_id: data.agencyId,
        date: data.date,
        time: data.time,
        notes: data.notes,
        exterior_front_photo: data.exteriorFrontPhotoUrl,
        exterior_rear_photo: data.exteriorRearPhotoUrl,
        interior_photo: data.interiorPhotoUrl,
        other_photos: data.otherPhotosUrls || [],
        client_signature: data.clientSignatureUrl,
      }], { onConflict: 'reservation_id,type' })
      .select()
      .single();

    if (error) throw error;
    return { id: inspection.id };
  }

  static async getInspection(id: string): Promise<VehicleInspection> {
    const { data, error } = await supabase
      .from('vehicle_inspections')
      .select(`
        *,
        inspection_responses(
          *,
          checklist_item:inspection_checklist_items(*)
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    return {
      id: data.id,
      reservationId: data.reservation_id,
      type: data.type,
      mileage: data.mileage,
      fuelLevel: data.fuel_level,
      location: data.agency_id,
      date: data.date,
      time: data.time,
      interiorPhotos: data.interior_photo ? [data.interior_photo] : [],
      exteriorPhotos: [
        data.exterior_front_photo,
        data.exterior_rear_photo,
        ...(data.other_photos || []),
      ].filter(Boolean),
      inspectionItems: data.inspection_responses || [],
      notes: data.notes,
      createdAt: data.created_at,
    };
  }

  static async saveInspectionResponse(inspectionId: string, checklistItemId: string, status: boolean, note?: string): Promise<void> {
    const { error } = await supabase
      .from('inspection_responses')
      .upsert(
        {
          inspection_id: inspectionId,
          checklist_item_id: checklistItemId,
          status,
          note,
        },
        { onConflict: 'inspection_id,checklist_item_id' }
      );

    if (error) throw error;
  }

  static async getChecklistItems(): Promise<any[]> {
    const { data, error } = await supabase
      .from('inspection_checklist_items')
      .select('*')
      .order('category')
      .order('display_order');

    if (error) throw error;
    return data || [];
  }

  static async addCustomChecklistItem(category: string, itemName: string): Promise<{ id: string }> {
    const { data, error } = await supabase
      .from('inspection_checklist_items')
      .insert([{
        category,
        item_name: itemName,
        display_order: 999, // Add at end
      }])
      .select()
      .single();

    if (error) throw error;
    return { id: data.id };
  }

  static async deleteChecklistItem(id: string): Promise<void> {
    const { error } = await supabase
      .from('inspection_checklist_items')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // ========== RESERVATION SERVICES ==========

  static async addService(data: {
    reservationId: string;
    category: 'decoration' | 'equipment' | 'insurance' | 'service' | 'driver';
    serviceName: string;
    description?: string;
    price: number;
    driverId?: string;
  }): Promise<{ id: string }> {
    const { data: service, error } = await supabase
      .from('reservation_services')
      .insert([{
        reservation_id: data.reservationId,
        category: data.category,
        service_name: data.serviceName,
        description: data.description,
        price: data.price,
        driver_id: data.driverId,
      }])
      .select()
      .single();

    if (error) throw error;
    return { id: service.id };
  }

  static async deleteService(serviceId: string): Promise<void> {
    const { error } = await supabase
      .from('reservation_services')
      .delete()
      .eq('id', serviceId);

    if (error) throw error;
  }

  static async getServices(reservationId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('reservation_services')
      .select('*')
      .eq('reservation_id', reservationId);

    if (error) throw error;
    return data || [];
  }

  static async updateReservationServices(reservationId: string, services: any[]): Promise<void> {
    // First, delete all existing services for this reservation
    const { error: deleteError } = await supabase
      .from('reservation_services')
      .delete()
      .eq('reservation_id', reservationId);

    if (deleteError) throw deleteError;

    // Then, add the new services
    if (services.length > 0) {
      const servicesToInsert = services.map(service => ({
        reservation_id: reservationId,
        category: service.category,
        service_name: service.service_name || service.name || service.serviceName,
        description: service.description,
        price: service.price,
        driver_id: service.driver_id || service.driverId,
        driver_caution: service.driver_caution || service.driverCaution || 0
      }));

      const { error: insertError } = await supabase
        .from('reservation_services')
        .insert(servicesToInsert);

      if (insertError) throw insertError;
    }
  }

  // ========== PAYMENTS ==========

  static async addPayment(data: {
    reservationId: string;
    amount: number;
    paymentMethod: 'cash' | 'card' | 'transfer' | 'check';
    date: string;
    note?: string;
  }): Promise<{ id: string }> {
    const { data: payment, error } = await supabase
      .from('payments')
      .insert([{
        reservation_id: data.reservationId,
        amount: data.amount,
        payment_method: data.paymentMethod,
        date: data.date,
        note: data.note,
      }])
      .select()
      .single();

    if (error) throw error;
    return { id: payment.id };
  }

  static async getPayments(reservationId: string): Promise<Payment[]> {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('reservation_id', reservationId)
      .order('date', { ascending: false });

    if (error) throw error;

    return (data || []).map(p => ({
      id: p.id,
      reservationId: p.reservation_id,
      amount: p.amount,
      date: p.date,
      method: p.payment_method,
      note: p.note,
      createdAt: p.created_at,
    }));
  }

  static async deletePayment(paymentId: string): Promise<void> {
    const { error } = await supabase
      .from('payments')
      .delete()
      .eq('id', paymentId);

    if (error) throw error;
  }

  // ========== PHOTO UPLOAD UTILITIES ==========

  static async uploadInspectionPhoto(
    file: File,
    reservationId: string,
    photoType: 'exterior-front' | 'exterior-rear' | 'interior' | 'other'
  ): Promise<string> {
    if (!file.type.startsWith('image/')) {
      throw new Error('File must be an image');
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new Error('File size must be less than 5MB');
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `inspection-${reservationId}-${photoType}-${Date.now()}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from('inspection')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) throw error;

    const { data: publicUrl } = supabase.storage
      .from('inspection')
      .getPublicUrl(data.path);

    return publicUrl.publicUrl;
  }

  static async uploadSignature(
    file: File,
    reservationId: string
  ): Promise<string> {
    if (!file.type.startsWith('image/')) {
      throw new Error('File must be an image');
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `signature-${reservationId}-${Date.now()}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from('inspection')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) throw error;

    const { data: publicUrl } = supabase.storage
      .from('inspection')
      .getPublicUrl(data.path);

    return publicUrl.publicUrl;
  }

  static async deleteInspectionFile(filePath: string): Promise<void> {
    const { error } = await supabase.storage
      .from('inspection')
      .remove([filePath]);

    if (error) throw error;
  }
}
