import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Clock, Calendar, ChevronDown, ChevronRight, User } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Consultorios = () => {
  const navigate = useNavigate();
  
  // State for dialog
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newDentist, setNewDentist] = useState({
    name: '',
    specialty: '',
    color: '#8B5CF6' // Default purple color
  });
  
  // Generate hours from 7 AM to 7 PM
  const hours = Array.from({ length: 13 }, (_, i) => {
    const hour = i + 7;
    return `${hour.toString().padStart(2, '0')}:00`;
  });

  const days = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  
  // Define 4 consultórios
  const consultorios = [
    { id: 'consultorio1', nome: 'Consultório 1', especialidade: 'Odontologia Geral' },
    { id: 'consultorio2', nome: 'Consultório 2', especialidade: 'Ortodontia' },
    { id: 'consultorio3', nome: 'Consultório 3', especialidade: 'Implantodontia' },
    { id: 'consultorio4', nome: 'Consultório 4', especialidade: 'Estética Dental' }
  ];
  
  // State for toggling each consultório table
  const [expandedConsultorios, setExpandedConsultorios] = useState({});
  
  // Generate empty schedule data for each consultório
  const generateScheduleData = (consultorioId) => {
    const schedule = {};
    days.forEach(day => {
      schedule[day] = {};
      hours.forEach(hour => {
        // Leave all slots empty
        schedule[day][hour] = null;
      });
    });
    return schedule;
  };

  const [schedules, setSchedules] = useState(() => {
    const initialSchedules = {};
    consultorios.forEach(consultorio => {
      initialSchedules[consultorio.id] = generateScheduleData(consultorio.id);
    });
    return initialSchedules;
  });

  const toggleConsultorio = (consultorioId) => {
    setExpandedConsultorios(prev => ({
      ...prev,
      [consultorioId]: !prev[consultorioId]
    }));
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'confirmado': return 'bg-green-100 text-green-700';
      case 'pendente': return 'bg-yellow-100 text-yellow-700';
      case 'em andamento': return 'bg-blue-100 text-blue-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const handleAddDentist = () => {
    console.log('Adding dentist:', newDentist);
    // Here you would typically save the dentist data
    setIsDialogOpen(false);
    setNewDentist({ name: '', specialty: '', color: '#8B5CF6' });
  };

  const handleInputChange = (field, value) => {
    setNewDentist(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-slate-50 p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => navigate('/home')}
              className="text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Consultórios</h1>
              <p className="text-slate-600">Gestão de cronograma e disponibilidade de consultórios</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button className="bg-purple-600 hover:bg-purple-700">
              <Plus className="h-4 w-4 mr-2" />
              Novo Agendamento
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-purple-200 text-purple-700 hover:bg-purple-50">
                <User className="h-4 w-4 mr-2" />
                Adicionar Dentista
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Adicionar Novo Dentista</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    placeholder="Nome do dentista"
                    value={newDentist.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="specialty">Especialidade</Label>
                  <Select value={newDentist.specialty} onValueChange={(value) => handleInputChange('specialty', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a especialidade" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="geral">Odontologia Geral</SelectItem>
                      <SelectItem value="ortodontia">Ortodontia</SelectItem>
                      <SelectItem value="implantodontia">Implantodontia</SelectItem>
                      <SelectItem value="estetica">Estética Dental</SelectItem>
                      <SelectItem value="pediatria">Odontopediatria</SelectItem>
                      <SelectItem value="endodontia">Endodontia</SelectItem>
                      <SelectItem value="periodontia">Periodontia</SelectItem>
                      <SelectItem value="cirurgia">Cirurgia Bucomaxilofacial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="color">Cor</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="color"
                      type="color"
                      value={newDentist.color}
                      onChange={(e) => handleInputChange('color', e.target.value)}
                      className="w-16 h-10 p-1 border rounded"
                    />
                    <Input
                      placeholder="#8B5CF6"
                      value={newDentist.color}
                      onChange={(e) => handleInputChange('color', e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>
                
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button 
                    onClick={handleAddDentist}
                    disabled={!newDentist.name || !newDentist.specialty}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    Adicionar Dentista
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        {/* Consultórios Tables */}
        <div className="space-y-4">
          {consultorios.map(consultorio => (
            <Card key={consultorio.id}>
              <CardHeader 
                className="cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => toggleConsultorio(consultorio.id)}
              >
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {expandedConsultorios[consultorio.id] ? (
                      <ChevronDown className="h-5 w-5 text-purple-600" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-purple-600" />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-semibold">{consultorio.nome}</span>
                        <Badge variant="secondary" className="text-xs">
                          {consultorio.especialidade}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-600 font-normal">
                        Clique para {expandedConsultorios[consultorio.id] ? 'ocultar' : 'ver'} cronograma
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-slate-600">
                      {Object.values(schedules[consultorio.id])
                        .flatMap(day => Object.values(day))
                        .filter(appointment => appointment !== null).length} agendamentos
                    </div>
                  </div>
                </CardTitle>
              </CardHeader>
              
              {expandedConsultorios[consultorio.id] && (
                <CardContent className="pt-0">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr>
                          <th className="border border-slate-200 bg-slate-50 p-2 text-left text-sm font-semibold text-slate-700">
                            Horário
                          </th>
                          {days.map(day => (
                            <th key={day} className="border border-slate-200 bg-slate-50 p-2 text-center text-sm font-semibold text-slate-700">
                              {day}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {hours.map(hour => (
                          <tr key={hour}>
                            <td className="border border-slate-200 bg-slate-50 p-2 text-sm font-medium text-slate-700">
                              {hour}
                            </td>
                            {days.map(day => {
                              const appointment = schedules[consultorio.id][day][hour];
                              return (
                                <td key={`${consultorio.id}-${day}-${hour}`} className="border border-slate-200 p-2">
                                  {appointment ? (
                                    <div className="space-y-1">
                                      <div className="text-xs font-medium text-slate-900">
                                        {appointment.patient}
                                      </div>
                                      <div className="text-xs text-slate-600">
                                        {appointment.procedure}
                                      </div>
                                      <Badge className={`text-xs ${getStatusColor(appointment.status)}`}>
                                        {appointment.status}
                                      </Badge>
                                    </div>
                                  ) : (
                                    <div className="text-xs text-slate-400 text-center">
                                      Disponível
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Consultorios;
