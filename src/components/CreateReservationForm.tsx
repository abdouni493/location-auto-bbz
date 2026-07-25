import React, { useState, useRef, useEffect } from 'react';
import { Language, ReservationDetails, Client, Car, VehicleInspection, Payment, AdditionalService, ProtectionAssurance } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, ArrowRight, Calendar, Clock, MapPin, Car as CarIcon, User, CreditCard, CheckCircle, Plus, Search, X, Camera, Fuel, AlertTriangle, Check, Upload, PenTool } from 'lucide-react';
import { AGENCIES, CAR_IMAGES } from '../constants';
import { DatabaseService } from '../services/DatabaseService';
import { ReservationsService } from '../services/ReservationsService';
import { uploadInspectionImage } from '../services/uploadInspectionImage';
import { calcTimbre, describeTimbre, TIMBRE_TIERS } from '../utils/timbre';
import { InspectionChecklist } from './inspection/InspectionChecklist';
import { InspectionPhotos, type InspectionPhoto, type PhotoSlot } from './inspection/InspectionPhotos';
import { ClientModal } from './ClientModal';
import { supabase } from '../supabase';

// ── Signature Pad Component ────────────────────────────────────────────────────
const SignaturePad: React.FC<{
  lang: Language;
  onSignatureChange: (signature: string) => void;
  initialSignature?: string;
}> = ({ lang, onSignatureChange, initialSignature }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    ctx.beginPath();
    ctx.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      onSignatureChange(canvas.toDataURL());
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    onSignatureChange('');
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    // Set drawing properties
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // If there is an initial signature, draw it onto the canvas
    if (initialSignature) {
      const img = new Image();
      // allow loading from storage URL (CORS) if possible
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setHasSignature(true);
        onSignatureChange(initialSignature);
      };
      img.src = initialSignature;
    } else {
      // clear if no initial signature
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHasSignature(false);
    }
  }, [initialSignature]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          className="w-full aspect-square border border-purple-300 rounded-lg cursor-crosshair bg-white"
          style={{ touchAction: 'none' }}
        />
        {!hasSignature && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center text-purple-400">
              <PenTool className="w-4 h-4 mx-auto mb-1" />
              <p className="text-xs font-bold">
                {lang === 'fr' ? 'Signez ici' : 'توقيع هنا'}
              </p>
            </div>
          )}
        )}
      </div>

      <div className="flex justify-between items-center">
        <p className="text-xs text-purple-700 font-bold uppercase tracking-tighter">
          {lang === 'fr' ? 'Signature numérique' : 'التوقيع الرقمي'}
        </p>
        <button
          onClick={clearSignature}
          className="text-red-600 hover:text-red-800 font-bold text-xs underline"
        >
          {lang === 'fr' ? 'Effacer' : 'حذف'}
        </button>
      </div>
    </div>
  );
};

interface CreateReservationFormProps {
  lang: Language;
  onBack: () => void;
  inspectionMode?: boolean;
  initialData?: Partial<ReservationDetails>;
  defaultStatus?: 'pending' | 'confirmed' | 'active' | 'completed' | 'cancelled';
  user?: any;
  altFlow?: boolean;
}

export const CreateReservationForm: React.FC<CreateReservationFormProps> = ({ lang, onBack, inspectionMode = false, initialData, defaultStatus = 'pending', user, altFlow = false }) => {
  const [currentStep, setCurrentStep] = useState(inspectionMode ? 3 : 1);
  const [agencies, setAgencies] = useState<any[]>([]);
  const [isLoadingAgencies, setIsLoadingAgencies] = useState(true);

  // Load agencies from database on component mount
  useEffect(() => {
    const loadAgencies = async () => {
      try {
        setIsLoadingAgencies(true);
        const data = await DatabaseService.getAgencies();
        setAgencies(data || []);
      } catch (err) {
        console.error('Error loading agencies:', err);
        setAgencies(AGENCIES);
      } finally {
        setIsLoadingAgencies(false);
      }
    };

    loadAgencies();
  }, []);

  useEffect(() => {
    if (inspectionMode && initialData) {
      const services = (initialData as any).additionalServices;
      const updates: any = {};
      if (services && services.length > 0 && !formData.step5?.additionalServices?.length) {
        updates.step5 = {
          additionalServices: services
        };
      }
      if (!formData.step1?.departureLocation) {
        const departureLocation = (initialData as any).step1?.departureLocation || (initialData as any).departureLocation || '';
        const returnLocation = (initialData as any).step1?.returnLocation || (initialData as any).returnLocation || departureLocation;
        const departureDate = (initialData as any).step1?.departureDate || (initialData as any).departureDate || formData.step1?.departureDate;
        const returnDate = (initialData as any).step1?.returnDate || (initialData as any).returnDate || formData.step1?.returnDate;
        const departureTime = (initialData as any).step1?.departureTime || (initialData as any).departureTime || '';
        const returnTime = (initialData as any).step1?.returnTime || (initialData as any).returnTime || '';
        
        updates.step1 = {
          ...formData.step1!,
          departureLocation,
          returnLocation,
          departureDate,
          returnDate,
          departureTime,
          returnTime,
          departureAgency: (initialData as any).step1?.departureAgency,
          returnAgency: (initialData as any).step1?.returnAgency
        };
      }
      if (!formData.step2?.selectedCar && (initialData as any).car) {
        updates.step2 = {
          selectedCar: (initialData as any).car
        };
      }
      if (!formData.step4?.selectedClient && (initialData as any).client) {
        updates.step4 = {
          selectedClient: (initialData as any).client
        };
      }
      if (Object.keys(updates).length > 0) {
        setFormData(prev => ({
          ...prev,
          ...updates
        }));
      }
    }
  }, [inspectionMode, initialData]);

  const [formData, setFormData] = useState<Partial<ReservationDetails>>(initialData || {
    step1: {
      departureDate: '',
      departureTime: '',
      returnDate: '',
      returnTime: '',
      departureLocation: ''
    },
    step2: {
      selectedCar: null
    },
    step3: {
      departureInspection: null
    },
    step4: {
      selectedClient: null
    },
    step5: {
      additionalServices: []
    },
    step6: {
      pricing: {
        basePrice: 0,
        additionalFees: 0,
        totalPrice: 0,
        advancePayment: 0,
        remainingPayment: 0,
        deposit: 0
      }
    }
  });

  const totalSteps = 7;
  const steps = altFlow ? [
    { id: 1, title: lang === 'fr' ? 'Dates & Lieu' : 'تواريخ والأماكن', icon: '📅' },
    { id: 2, title: lang === 'fr' ? 'Sélection Véhicule' : 'اختيار السيارة', icon: '🚗' },
    { id: 3, title: lang === 'fr' ? 'Tarification Finale' : 'التسعير النهائي', icon: '💰' },
    { id: 4, title: lang === 'fr' ? 'Client' : 'عميل', icon: '👤' },
    { id: 5, title: lang === 'fr' ? 'Assurance de Protection' : 'ضمان الحماية', icon: '🛡️' },
    { id: 6, title: lang === 'fr' ? 'Services Supplémentaires' : 'خدمات إضافية', icon: '🛡️' },
    { id: 7, title: lang === 'fr' ? 'Inspection Départ' : 'فحص البداية', icon: '🔍' }
  ] : [
    { id: 1, title: lang === 'fr' ? 'Dates & Lieu' : 'تواريخ والأماكن', icon: '📅' },
    { id: 2, title: lang === 'fr' ? 'Sélection Véhicule' : 'اختيار السيارة', icon: '🚗' },
    { id: 3, title: lang === 'fr' ? 'Inspection Départ' : 'فحص البداية', icon: '🔍' },
    { id: 4, title: lang === 'fr' ? 'Client' : 'عميل', icon: '👤' },
    { id: 5, title: lang === 'fr' ? 'Assurance de Protection' : 'ضمان الحماية', icon: '🛡️' },
    { id: 6, title: lang === 'fr' ? 'Services Supplémentaires' : 'خدمات إضافية', icon: '🛡️' },
    { id: 7, title: lang === 'fr' ? 'Tarification Finale' : 'التسعير النهائي', icon: '💰' }
  ];

  const handleNext = () => {
    if (inspectionMode && currentStep === 3) {
      setCurrentStep(6);
    } else if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (inspectionMode && currentStep === 6) {
      setCurrentStep(3);
    } else if (inspectionMode && currentStep === 7) {
      setCurrentStep(6);
    } else if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // ── Helper function to check if inspection has any input ──────────────────────
  const hasInspectionInput = (): boolean => {
    const inspection = formData.step3?.departureInspection;
    if (!inspection) return false;

    // Check if any inspection field has been filled
    return !!(
      inspection.mileage ||
      inspection.fuelLevel ||
      (inspection.exteriorPhotos && inspection.exteriorPhotos.length > 0) ||
      (inspection.interiorPhotos && inspection.interiorPhotos.length > 0) ||
      (inspection.otherPhotos && inspection.otherPhotos.length > 0) ||
      inspection.notes ||
      inspection.signature ||
      (inspection.inspectionItems && inspection.inspectionItems.some((it: any) => it.checked || it.note))
    );
  };

  const handleSubmit = async () => {
    try {
      // Find agency IDs
      const departureAgency = agencies.find(a => a.name === formData.step1?.departureLocation || a.address === formData.step1?.departureLocation);
      const returnAgency = agencies.find(a => a.name === formData.step1?.returnLocation || a.address === formData.step1?.returnLocation) || departureAgency;

      // Skip agency validation if inspectionMode (for both pending and accepted reservations)
      if (!(inspectionMode && initialData)) {
        if (!departureAgency || !returnAgency) {
          alert(lang === 'fr' ? 'Agence introuvable' : 'وكالة غير محددة بشكل صحيح');
          return;
        }
      }

      // Calculate total days
      const totalDays = Math.ceil((new Date(formData.step1.returnDate).getTime() - new Date(formData.step1.departureDate).getTime()) / (1000 * 60 * 60 * 24));

      // Calculate total price
      const step6 = formData.step6 || {};
      const totalPrice = step6.totalPrice || 0;
      const advancePayment = step6.advancePayment || 0;
      const remainingPayment = Math.max(0, totalPrice - advancePayment);

      // Skip client/car validation if inspectionMode (for both pending and accepted reservations)
      if (!(inspectionMode && initialData)) {
        if (!formData.step4?.selectedClient?.id || !formData.step2?.selectedCar?.id || !departureAgency?.id || !returnAgency?.id) {
          alert(lang === 'fr' ? 'Veuillez sélectionner un client, un véhicule et des agences valides.' : 'يرجى اختيار عميل وسيارة ووكالات صحيحة.');
          return;
        }
      }
      let clientId = formData.step4?.selectedClient?.id || '';
      let carId = formData.step2?.selectedCar?.id || '';
      let departureAgencyId = departureAgency?.id || '';
      let returnAgencyId = returnAgency?.id || '';
      if (inspectionMode && initialData) {
        clientId = (initialData as any)?.client?.id || '';
        carId = (initialData as any)?.car?.id || '';
        departureAgencyId = (initialData as any)?.departure_agency_id || (initialData as any)?.departureAgencyId || (initialData as any)?.step1?.departureAgency || '';
        returnAgencyId = (initialData as any)?.return_agency_id || (initialData as any)?.returnAgencyId || (initialData as any)?.step1?.returnAgency || '';
        // Block if any required UUID is missing
        if (!clientId || !carId || !departureAgencyId || !returnAgencyId) {
          alert(lang === 'fr' ? "Impossible de créer la réservation: données manquantes (client, véhicule ou agences)." : "لا يمكن إنشاء الحجز: بيانات مفقودة (عميل أو سيارة أو وكالات).");
          return;
        }
      }
      
      // Use appropriate function based on mode
      let reservationId: string;
      if (inspectionMode && initialData) {
        // Update existing reservation in inspection mode and change status to confirmed
        reservationId = (initialData as any).id;
        await ReservationsService.updateReservation(reservationId, {
          status: 'confirmed',
          notes: formData.step6?.notes || '',
          totalPrice: totalPrice,
          advancePayment: advancePayment,
          remainingPayment: remainingPayment,
        });
      } else {
        // Create new reservation
        // Declared outside the try/catch so the catch block can reference it
        // when logging (previously threw "workerFullName is not defined",
        // which masked the real Supabase error).
        let workerFullName: string | null = null;
        try {
          // Fetch worker's full name from database using email
          if (user?.email) {
            try {
              console.log('🔍 Fetching worker by email:', user.email);
              
              const { data: workerData, error: workerError } = await supabase
                .from('workers')
                .select('full_name, email, username')
                .eq('email', user.email)
                .single();
              
              console.log('✅ Worker query result:', {
                data: workerData,
                error: workerError?.message
              });
              
              if (!workerError && workerData) {
                workerFullName = workerData.full_name;
                console.log('✅ Successfully fetched worker full_name:', workerFullName);
              } else {
                console.log('❌ Could not fetch worker:', workerError?.message);
                // Don't fall back to user.name (which might be email)
              }
            } catch (err: any) {
              console.error('❌ Error fetching worker:', err);
            }
          }
          
          console.log('Creating reservation with creator info:', {
            userEmail: user?.email,
            workerFullName: workerFullName
          });
          
          const result = await ReservationsService.createReservation({
            clientId,
            carId,
            departureDate: formData.step1?.departureDate || '',
            departureTime: formData.step1?.departureTime || '',
            departureAgencyId,
            returnDate: formData.step1?.returnDate || '',
            returnTime: formData.step1?.returnTime || '',
            returnAgencyId,
            pricePerDay: formData.step2?.selectedCar?.priceDay || 0,
            priceWeek: formData.step2?.selectedCar?.priceWeek || 0,
            priceMonth: formData.step2?.selectedCar?.priceMonth || 0,
            totalDays: totalDays,
            totalPrice: totalPrice,
            deposit: formData.step2?.selectedCar?.deposit || 0,
            advancePayment: advancePayment,
            remainingPayment: remainingPayment,
            // L'étape à Inspection Départ · décide du statut : si l'agent y a
            // saisi quoi que ce soit (kilométrage, carburant, checklist, photos,
            // notes, signature), la location est prête et la réservation est
            // créée CONFIRMÉE. Sinon elle reste en attente.
            status: hasInspectionInput() ? 'confirmed' : 'pending',
            notes: formData.step6?.notes || '',
            // Caution and Assurance fields
            cautionAmountDzd: (formData.step6 as any)?.caution_amount_dzd || formData.step2?.selectedCar?.deposit || 0,
            cautionCurrency: (formData.step6 as any)?.cautionCurrency || 'DZD',
            euroRate: (formData.step6 as any)?.euroRate || 145,
            assuranceEnabled: (formData.step6 as any)?.assuranceEnabled || false,
            assurancePercentage: (formData.step6 as any)?.assuranceEnabled
              ? (formData.step6 as any)?.assurancePercentage !== ''
                ? Number((formData.step6 as any)?.assurancePercentage)
                : 0
              : 0,
            // Timbre fiscal : le total enregistré l'inclus déjà si l'agent l'a activé.
            timbreEnabled: (formData.step6 as any)?.timbreEnabled || false,
            timbreAmount: (formData.step6 as any)?.timbreAmount || 0,
            // Assurance de protection sélectionnée (snapshot nom + prix/jour)
            protectionAssuranceId: formData.protectionAssurance?.id || null,
            protectionAssuranceName: formData.protectionAssurance?.name || null,
            protectionAssurancePrice: formData.protectionAssurance?.pricePerDay ?? null,
            // Creator info - Only save name since User object doesn't have ID
            createdBy: null,
            createdByName: workerFullName || null,
          });
          
          console.log('✅ Reservation created successfully with ID:', result.id);
          reservationId = result.id;
        } catch (creationError: any) {
          console.error('❌ Error creating reservation with creator info:', {
            message: creationError?.message,
            error: creationError,
            stack: creationError?.stack
          });
          throw creationError;
        }
      }

      // Save selected services
      const selectedServices = formData.step5?.additionalServices || [];
      if (selectedServices.length > 0) {
        await ReservationsService.updateReservationServices(reservationId, selectedServices);
      }

      // Save departure inspection if present
      const inspection = formData.step3?.departureInspection;
      if (inspection) {
        try {
          // Determine agency_id: prefer explicit agency id from step1, else fallback to first agency
          const agencyId = formData.step1?.departureAgency || (agencies && agencies[0]?.id) || '';

          // Check if a departure inspection already exists for this reservation
          const existingDeparture = formData.departureInspection;
          if (existingDeparture && existingDeparture.id) {
            // Update existing inspection
            await DatabaseService.updateVehicleInspection(existingDeparture.id, {
              mileage: inspection.mileage || 0,
              fuel_level: inspection.fuelLevel || 'full',
              agency_id: agencyId,
              exterior_front_photo: inspection.exteriorPhotos?.[0] || null,
              exterior_rear_photo: inspection.exteriorPhotos?.[1] || null,
              interior_photo: inspection.interiorPhotos?.[0] || null,
              other_photos: inspection.other_photos || inspection.otherPhotos || [],
              client_signature: inspection.signature || inspection.client_signature || null,
              notes: inspection.notes || null,
              date: inspection.date || new Date().toISOString().split('T')[0],
              time: inspection.time || new Date().toTimeString().split(' ')[0]
            });

            // Save checklist responses for ALL items (store true/false)
            const responses = (inspection.inspectionItems || []).map((it: any) => ({
              inspection_id: existingDeparture.id,
              checklist_item_id: it.id,
              status: !!it.checked,
              note: it.note || null
            }));

            if (responses.length > 0) {
              await DatabaseService.upsertInspectionResponses(responses);
            }

            // Update car mileage
            if (inspection.mileage && inspection.mileage > 0) {
              await DatabaseService.updateCar(formData.step2.selectedCar.id, {
                mileage: inspection.mileage
              });
            }
          } else {
            // Create new inspection if none exists
            const createdInspection = await DatabaseService.createVehicleInspection({
              reservation_id: reservationId,
              type: 'departure',
              mileage: inspection.mileage || 0,
              fuel_level: inspection.fuelLevel || 'full',
              agency_id: agencyId,
              exterior_front_photo: inspection.exteriorPhotos?.[0] || null,
              exterior_rear_photo: inspection.exteriorPhotos?.[1] || null,
              interior_photo: inspection.interiorPhotos?.[0] || null,
              other_photos: inspection.other_photos || inspection.otherPhotos || [],
              client_signature: inspection.signature || inspection.client_signature || null,
              notes: inspection.notes || null,
              date: inspection.date || new Date().toISOString().split('T')[0],
              time: inspection.time || new Date().toTimeString().split(' ')[0]
            });

            // Save checklist responses for ALL items (store true/false)
            const responses = (inspection.inspectionItems || []).map((it: any) => ({
              inspection_id: createdInspection.id,
              checklist_item_id: it.id,
              status: !!it.checked,
              note: it.note || null
            }));

            if (responses.length > 0) {
              await DatabaseService.upsertInspectionResponses(responses);
            }

            // Update car mileage
            if (inspection.mileage && inspection.mileage > 0) {
              await DatabaseService.updateCar(formData.step2.selectedCar.id, {
                mileage: inspection.mileage
              });
            }
          }
        } catch (err) {
          console.error('Error saving inspection:', err);
        }
      }


      onBack();
    } catch (err: any) {
      console.error('❌ Error ' + (inspectionMode && initialData ? 'updating' : 'creating') + ' reservation:', {
        message: err?.message,
        error: err,
        stack: err?.stack
      });
      alert(lang === 'fr' ? `Erreur: ${err.message}` : `خطأ: ${err.message}`);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, field: string) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setFormData(prev => ({
          ...prev,
          step4: {
            ...(prev.step4 || {}),
            [field]: result
          }
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-white hover:text-blue-200 font-bold"
          >
            <ArrowLeft className="w-5 h-5" />
            {lang === 'fr' ? 'Retour' : 'إرجاع'}
          </button>
          <div>
            <h2 className="text-3xl font-black text-white uppercase tracking-tighter">
              🔄 {lang === 'fr' ? 'Nouvelle Réservation' : 'احتياطي جديد'}
            </h2>
            <p className="text-white font-bold uppercase text-[10px] tracking-widest">
              {`${lang === 'fr' ? 'Étape' : 'مرحلة'} ${currentStep} ${lang === 'fr' ? 'sur' : 'من'} ${totalSteps}`}
            </p>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          {steps.map((step) => (
            <div key={step.id} className="flex flex-col items-center flex-1">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg mb-2 transition-colors ${
                step.id < currentStep ? 'bg-green-500 text-white'
                : step.id === currentStep ? 'bg-blue-500 text-white'
                : 'bg-slate-200 text-slate-500'
              }`}>
                {step.id < currentStep ? <CheckCircle className="w-6 h-6" /> : step.icon}
              </div>
              <p className={`text-xs font-bold text-center ${
                step.id <= currentStep ? 'text-slate-900' : 'text-slate-500'
              }`}>
                {step.title}
              </p>
            </div>
          ))}
        </div>
        <div className="w-full bg-slate-200 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${(currentStep / totalSteps) * 100}%` }}
          />
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-8">
          <button
            onClick={handlePrevious}
            disabled={currentStep === 1}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-bold transition-colors ${
              currentStep === 1
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-slate-600 hover:bg-slate-700 text-white'
            }`}
          >
            <ArrowLeft className="w-4 h-4" />
            {lang === 'fr' ? 'Précédent' : 'السابق'}
          </button>

          {currentStep < totalSteps ? (
            <button
              onClick={handleNext}
              className="btn-saas-primary flex items-center gap-2"
            >
              {lang === 'fr' ? 'Suivant' : 'التالي'}
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              className="btn-saas-primary flex items-center gap-2"
            >
              🔄 {lang === 'fr' ? 'Créer Réservation' : 'إنشاء احتياطي'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
