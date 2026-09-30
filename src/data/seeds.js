import { addDaysToKey, todayKey } from '../utils/dates';

/**
 * First-run sample data. It is written to AsyncStorage like any other item,
 * so everything below is fully editable/deletable from the UI.
 * Reminders are intentionally left unscheduled (`notificationId: null`) so the
 * app never fires notifications the user did not explicitly ask for.
 */

export function seedActivities() {
  return [
    { id: 'seed-act-1', day: 0, title: 'Cálculo I', start: '08:00', end: '10:00', location: 'Aula B-204', color: '#4fd1c5' },
    { id: 'seed-act-2', day: 0, title: 'Algoritmos', start: '10:30', end: '12:00', location: 'Lab 3', color: '#8b5cf6' },
    { id: 'seed-act-3', day: 1, title: 'Gym', start: '19:00', end: '20:15', location: 'Centro', color: '#f59e0b' },
    { id: 'seed-act-4', day: 2, title: 'Inglés', start: '16:00', end: '17:30', location: 'Online', color: '#38bdf8' },
    { id: 'seed-act-5', day: 3, title: 'Proyecto final', start: '14:00', end: '16:00', location: 'Biblioteca', color: '#ec4899' },
    { id: 'seed-act-6', day: 4, title: 'Cálculo I', start: '08:00', end: '10:00', location: 'Aula B-204', color: '#4fd1c5' },
  ];
}

export function seedEvents() {
  const today = todayKey();
  return [
    {
      id: 'seed-evt-1',
      dateKey: addDaysToKey(today, 2),
      time: '18:30',
      title: 'Entrega del proyecto',
      notes: 'Subir el PDF a la plataforma y avisar al grupo.',
      leadMinutes: 60,
      color: '#ec4899',
      notificationId: null,
    },
    {
      id: 'seed-evt-2',
      dateKey: addDaysToKey(today, 5),
      time: '11:00',
      title: 'Parcial 2',
      notes: 'Traer DNI y birome azul.',
      leadMinutes: 1440,
      color: '#8b5cf6',
      notificationId: null,
    },
  ];
}

export function seedBirthdays() {
  return [
    {
      id: 'seed-bdr-1',
      name: 'Camila',
      emoji: '🎧',
      dateKey: '2002-03-14',
      time: '09:00',
      daysBefore: 0,
      color: '#8b5cf6',
      notificationId: null,
    },
    {
      id: 'seed-bdr-2',
      name: 'Tomás',
      emoji: '⚽',
      dateKey: '1999-11-02',
      time: '08:30',
      daysBefore: 1,
      color: '#38bdf8',
      notificationId: null,
    },
  ];
}

export function seedNotes() {
  const now = Date.now();
  return [
    {
      id: 'seed-note-1',
      title: 'Pendientes de la semana',
      body:
        '· Resumen de Cálculo (temas 4 y 5)\n· Pulir la intro del proyecto\n· Cotizar el viaje\n· Comprar regalo para Camila',
      color: '#a3e635',
      pinned: true,
      createdAt: now - 86400000 * 3,
      updatedAt: now - 3600000 * 5,
    },
    {
      id: 'seed-note-2',
      title: 'Ideas',
      body: 'Exportar el horario a PDF y sincronizarlo con el calendario del celu.',
      color: '#4fd1c5',
      pinned: false,
      createdAt: now - 86400000 * 9,
      updatedAt: now - 86400000 * 2,
    },
  ];
}
export function seedHabits() {
  const today = todayKey();
  return [
    { id: 'seed-hab-1', name: 'Tomar 2 L de agua', emoji: '💧', color: '#38bdf8', marks: [today] },
    { id: 'seed-hab-2', name: 'Leer 20 minutos', emoji: '📚', color: '#a3e635', marks: [] },
    { id: 'seed-hab-3', name: 'Entrenar', emoji: '🏃', color: '#f59e0b', marks: [addDaysToKey(today, -1), addDaysToKey(today, -2)] },
  ];
}

export function seedExpenses() {
  const today = todayKey();
  return [
    {
      id: 'seed-exp-1',
      dateKey: today,
      amount: 1850,
      category: 'Comida',
      note: 'Almuerzo en la facultad',
      createdAt: Date.now() - 3600000 * 3,
    },
    {
      id: 'seed-exp-2',
      dateKey: addDaysToKey(today, -1),
      amount: 900,
      category: 'Transporte',
      note: 'Colectivo ida y vuelta',
      createdAt: Date.now() - 86400000,
    },
  ];
}

