import { useState, useEffect } from 'react';
import { X, CheckCircle2, ArrowRight, MessageCircle } from 'lucide-react';
import { WHATSAPP_NUMBER } from '@/config/contact';

interface LeadFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialRoomName?: string;
}

type Objective = 'doubt' | 'reserve';

interface FormData {
    name: string;
    phone: string;
    profession: string;
    objective: Objective;
    // Step 2 (Reserve only)
    roomName: string;
    hours: string;
}

export default function LeadFormModal({ isOpen, onClose, initialRoomName }: LeadFormModalProps) {
    const [step, setStep] = useState<1 | 2>(1);
    const [formData, setFormData] = useState<FormData>({
        name: '',
        phone: '',
        profession: '',
        objective: 'doubt',
        roomName: initialRoomName || '',
        hours: '1',
    });

    // Reset form when modal opens
    useEffect(() => {
        if (isOpen) {
            setStep(1);
            setFormData(prev => ({
                ...prev,
                roomName: initialRoomName || prev.roomName,
                objective: 'doubt'
            }));
        }
    }, [isOpen, initialRoomName]);

    if (!isOpen) return null;

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleObjectiveSelect = (objective: Objective) => {
        setFormData(prev => ({ ...prev, objective }));
    };

    const handleSubmitStep1 = (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.objective === 'doubt') {
            redirectToWhatsApp();
        } else {
            setStep(2);
        }
    };

    const handleSubmitStep2 = (e: React.FormEvent) => {
        e.preventDefault();
        redirectToWhatsApp();
    };

    const redirectToWhatsApp = () => {
        let message = '';

        if (formData.objective === 'doubt') {
            message = `Olá! Me chamo ${formData.name}, sou ${formData.profession} e tenho algumas dúvidas sobre os consultórios.`;
        } else {
            const room = formData.roomName || 'um consultório';
            const hoursText = formData.hours === '1' ? '1 hora' : `${formData.hours} horas`;
            message = `Olá! Me chamo ${formData.name}, sou ${formData.profession} e gostaria de reservar o ${room} por ${hoursText}. Meu número de contato é ${formData.phone}.`;
        }



        const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="bg-warm-50 px-6 py-4 flex items-center justify-between border-b border-warm-100">
                    <h2 className="text-lg font-bold text-primary-900">
                        {step === 1 ? 'Vamos começar' : 'Detalhes da reserva'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-secondary-400 hover:text-secondary-600 transition-colors rounded-full p-1 hover:bg-warm-100"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6">
                    {step === 1 ? (
                        <form onSubmit={handleSubmitStep1} className="space-y-4">
                            <div>
                                <label htmlFor="name" className="block text-sm font-medium text-secondary-700 mb-1">
                                    Seu nome
                                </label>
                                <input
                                    type="text"
                                    id="name"
                                    name="name"
                                    required
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    className="w-full px-4 py-2 rounded-lg border border-warm-200 focus:border-accent-500 focus:ring-2 focus:ring-accent-200 outline-none transition-all"
                                    placeholder="Como gostaria de ser chamado?"
                                />
                            </div>

                            <div>
                                <label htmlFor="phone" className="block text-sm font-medium text-secondary-700 mb-1">
                                    WhatsApp / Telefone
                                </label>
                                <input
                                    type="tel"
                                    id="phone"
                                    name="phone"
                                    required
                                    value={formData.phone}
                                    onChange={handleInputChange}
                                    className="w-full px-4 py-2 rounded-lg border border-warm-200 focus:border-accent-500 focus:ring-2 focus:ring-accent-200 outline-none transition-all"
                                    placeholder="(DDD) 99999-9999"
                                />
                            </div>

                            <div>
                                <label htmlFor="profession" className="block text-sm font-medium text-secondary-700 mb-1">
                                    Profissão
                                </label>
                                <input
                                    type="text"
                                    id="profession"
                                    name="profession"
                                    required
                                    value={formData.profession}
                                    onChange={handleInputChange}
                                    className="w-full px-4 py-2 rounded-lg border border-warm-200 focus:border-accent-500 focus:ring-2 focus:ring-accent-200 outline-none transition-all"
                                    placeholder="Ex: Psicólogo, Nutricionista..."
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-secondary-700 mb-2">
                                    Qual é o seu objetivo?
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => handleObjectiveSelect('doubt')}
                                        className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${formData.objective === 'doubt'
                                            ? 'border-accent-500 bg-accent-50 text-accent-700'
                                            : 'border-warm-100 hover:border-accent-200 text-secondary-600'
                                            }`}
                                    >
                                        <MessageCircle className={`w-6 h-6 mb-1 ${formData.objective === 'doubt' ? 'text-accent-600' : 'text-secondary-400'}`} />
                                        <span className="text-sm font-semibold">Tirar dúvidas</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleObjectiveSelect('reserve')}
                                        className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${formData.objective === 'reserve'
                                            ? 'border-accent-500 bg-accent-50 text-accent-700'
                                            : 'border-warm-100 hover:border-accent-200 text-secondary-600'
                                            }`}
                                    >
                                        <CheckCircle2 className={`w-6 h-6 mb-1 ${formData.objective === 'reserve' ? 'text-accent-600' : 'text-secondary-400'}`} />
                                        <span className="text-sm font-semibold">Fazer reserva</span>
                                    </button>
                                </div>
                            </div>

                            <div className="pt-2">
                                <button
                                    type="submit"
                                    className="w-full bg-accent-600 text-white font-bold py-3 rounded-xl hover:bg-accent-700 transition-colors flex items-center justify-center gap-2"
                                >
                                    {formData.objective === 'doubt' ? (
                                        <>
                                            Falar com Atendimento
                                            <MessageCircle className="w-5 h-5" />
                                        </>
                                    ) : (
                                        <>
                                            Continuar
                                            <ArrowRight className="w-5 h-5" />
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    ) : (
                        <form onSubmit={handleSubmitStep2} className="space-y-4 animate-in slide-in-from-right-10 duration-200">
                            <div>
                                <label htmlFor="roomName" className="block text-sm font-medium text-secondary-700 mb-1">
                                    Qual consultório?
                                </label>
                                <select
                                    id="roomName"
                                    name="roomName"
                                    value={formData.roomName}
                                    onChange={handleInputChange}
                                    className="w-full px-4 py-2 rounded-lg border border-warm-200 focus:border-accent-500 focus:ring-2 focus:ring-accent-200 outline-none transition-all bg-white"
                                >
                                    <option value="">Selecione...</option>
                                    <option value="Consultório 1 | Prime">Consultório 1 | Prime</option>
                                    <option value="Consultório 2 | Executive">Consultório 2 | Executive</option>
                                    <option value="Consultório 3 | Essential">Consultório 3 | Essential</option>
                                </select>
                            </div>

                            <div>
                                <label htmlFor="hours" className="block text-sm font-medium text-secondary-700 mb-1">
                                    Quantas horas deseja comprar?
                                </label>
                                <select
                                    id="hours"
                                    name="hours"
                                    value={formData.hours}
                                    onChange={handleInputChange}
                                    className="w-full px-4 py-2 rounded-lg border border-warm-200 focus:border-accent-500 focus:ring-2 focus:ring-accent-200 outline-none transition-all bg-white"
                                >
                                    <option value="1">1 hora (Avulso)</option>
                                    <option value="10">Pacote 10 horas</option>
                                    <option value="20">Pacote 20 horas</option>
                                    <option value="40">Pacote 40 horas</option>
                                </select>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setStep(1)}
                                    className="flex-shrink-0 px-4 py-3 rounded-xl border border-warm-200 text-secondary-600 font-semibold hover:bg-warm-50 transition-colors"
                                >
                                    Voltar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                                >
                                    Solicitar Reserva
                                    <MessageCircle className="w-5 h-5" />
                                </button>
                            </div>
                        </form>
                    )}
                </div>

                {/* Footer info */}
                <div className="px-6 py-3 bg-warm-50/50 text-center text-xs text-secondary-400 border-t border-warm-100">
                    Seu contato será direcionado para nossa equipe via WhatsApp.
                </div>
            </div>
        </div>
    );
}
