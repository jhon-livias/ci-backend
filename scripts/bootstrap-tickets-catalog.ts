import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../apps/tickets/src/infrastructure/persistence/generated/client.js';

const AREA = {
  diradm: '0a0a0a0a-0001-4000-8000-000000000001',
  ti: '0a0a0a0a-0001-4000-8000-000000000002',
  rrhh: '0a0a0a0a-0001-4000-8000-000000000003',
  fdcs: '0a0a0a0a-0001-4000-8000-000000000004',
  edui: '0a0a0a0a-0001-4000-8000-000000000005',
  edup: '0a0a0a0a-0001-4000-8000-000000000006',
} as const;

const required = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} es obligatoria.`);
  return value;
};

const main = async (): Promise<void> => {
  const prisma = new PrismaClient({ adapter: new PrismaPg(required('TICKETS_DATABASE_URL'), { schema: 'tickets' }) });
  try {
    const areas = [
      { id: AREA.diradm, parentId: null, code: 'DIRADM', name: 'Dirección Administrativa', responsibility: 'Administración general de los recursos de la universidad.', managerName: 'Roberto Salinas', managerDocument: '10203040', managerEmail: 'rsalinas@uprit.edu.pe', receivesTickets: false, allowsInternal: true, canCreateTickets: true },
      { id: AREA.ti, parentId: AREA.diradm, code: 'TI', name: 'Tecnologías de la Información', responsibility: 'Soporte tecnológico, sistemas institucionales, redes y equipos.', managerName: 'Luis Castillo', managerDocument: '70123456', managerEmail: 'luis.castillo@uprit.edu.pe', receivesTickets: true, allowsInternal: true, canCreateTickets: true },
      { id: AREA.rrhh, parentId: AREA.diradm, code: 'RRHH', name: 'Recursos Humanos', responsibility: 'Gestión del talento, nóminas y clima laboral.', managerName: 'María Gómez', managerDocument: '87654321', managerEmail: 'mgomez@uprit.edu.pe', receivesTickets: false, allowsInternal: true, canCreateTickets: true },
      { id: AREA.fdcs, parentId: null, code: 'FDCS', name: 'Facultad de Derecho y Ciencias Sociales', responsibility: 'Gestión y dirección académica de la facultad.', managerName: 'Luis Alvarado', managerDocument: '99887766', managerEmail: 'lalvarado@uprit.edu.pe', receivesTickets: false, allowsInternal: false, canCreateTickets: false },
      { id: AREA.edui, parentId: AREA.fdcs, code: 'EDUI', name: 'Educación Inicial', responsibility: 'Coordinación general de la carrera de Educación Inicial.', managerName: 'Carmen Rosa', managerDocument: '44556677', managerEmail: 'crosa@uprit.edu.pe', receivesTickets: false, allowsInternal: false, canCreateTickets: false },
      { id: AREA.edup, parentId: AREA.fdcs, code: 'EDUP', name: 'Educación Primaria', responsibility: 'Coordinación general de la carrera de Educación Primaria.', managerName: 'José Díaz', managerDocument: '55664433', managerEmail: 'jdiaz@uprit.edu.pe', receivesTickets: false, allowsInternal: false, canCreateTickets: false },
    ] as const;
    for (const area of areas) {
      await prisma.area.upsert({
        where: { id: area.id },
        update: { ...area, enabled: true },
        create: { ...area, enabled: true },
      });
    }

    const categories = [
      { id: '0a0a0a0a-0002-4000-8000-000000000001', areaId: AREA.ti, name: 'Correo institucional', description: 'Problemas para ingresar, enviar o recibir correos.' },
      { id: '0a0a0a0a-0002-4000-8000-000000000002', areaId: AREA.ti, name: 'Acceso y contraseñas', description: 'Olvido o bloqueo de contraseña y accesos.' },
      { id: '0a0a0a0a-0002-4000-8000-000000000003', areaId: AREA.ti, name: 'Equipos y periféricos', description: 'Computadoras, impresoras, proyectores y otros equipos.' },
      { id: '0a0a0a0a-0002-4000-8000-000000000004', areaId: AREA.ti, name: 'Sistemas y plataformas', description: 'Aula virtual, sistema académico y demás plataformas.' },
      { id: '0a0a0a0a-0002-4000-8000-000000000005', areaId: AREA.ti, name: 'Red e internet', description: 'Sin conexión o conexión lenta.' },
      { id: '0a0a0a0a-0002-4000-8000-000000000006', areaId: AREA.ti, name: 'Horarios / configuración', description: 'Configuración de horarios y cuentas en sistemas.' },
      { id: '0a0a0a0a-0002-4000-8000-000000000007', areaId: AREA.ti, name: 'Otro / no estoy seguro', description: 'Cuando el problema no encaja en otra categoría.' },
      { id: '0a0a0a0a-0002-4000-8000-000000000008', areaId: AREA.ti, name: 'Mantenimiento de equipos', description: 'Mantenimiento preventivo y correctivo.' },
      { id: '0a0a0a0a-0002-4000-8000-000000000009', areaId: AREA.ti, name: 'Software', description: 'Instalación y actualización de software.' },
    ] as const;
    for (const category of categories) {
      await prisma.ticketCategory.upsert({
        where: { id: category.id },
        update: { ...category, enabled: true },
        create: { ...category, enabled: true },
      });
    }

    const team = [
      { id: '0a0a0a0a-0003-4000-8000-000000000001', fullName: 'Luis Castillo', document: '70123456', roleTitle: 'Responsable de TI', email: 'luis.castillo@uprit.edu.pe', phone: '949123456', functions: 'Supervisión general de TI - Sistemas y plataformas - Gestión de incidentes críticos', schedule: 'Lunes a viernes: 8:45 a. m. a 5:00 p. m.', isManager: true },
      { id: '0a0a0a0a-0003-4000-8000-000000000002', fullName: 'María Salazar', document: '71234561', roleTitle: 'Asistente de soporte TI', email: 'maria.salazar@uprit.edu.pe', phone: '987654321', functions: 'Correo institucional - Acceso y contraseñas', schedule: 'Lunes a viernes: 8:45 a. m. a 5:00 p. m.', isManager: false },
      { id: '0a0a0a0a-0003-4000-8000-000000000003', fullName: 'Sergio Torres', document: '72345612', roleTitle: 'Asistente de soporte TI', email: 'sergio.torres@uprit.edu.pe', phone: '976543210', functions: 'Correo institucional - Software', schedule: 'Lunes a viernes: 8:45 a. m. a 5:00 p. m.', isManager: false },
      { id: '0a0a0a0a-0003-4000-8000-000000000004', fullName: 'Diego Flores', document: '73456123', roleTitle: 'Especialista de infraestructura', email: 'diego.flores@uprit.edu.pe', phone: '965432109', functions: 'Red e internet - Mantenimiento de equipos', schedule: 'Lunes a viernes: 8:45 a. m. a 5:00 p. m.', isManager: false },
      { id: '0a0a0a0a-0003-4000-8000-000000000005', fullName: 'Carla Rojas', document: '74561234', roleTitle: 'Técnica de soporte', email: 'carla.rojas@uprit.edu.pe', phone: '954321098', functions: 'Equipos y periféricos - Mantenimiento de equipos', schedule: 'Lunes a viernes: 8:45 a. m. a 5:00 p. m.', isManager: false },
      { id: '0a0a0a0a-0003-4000-8000-000000000006', fullName: 'Jorge Paredes', document: '75612345', roleTitle: 'Analista de sistemas', email: 'jorge.paredes@uprit.edu.pe', phone: '943210987', functions: 'Sistemas y plataformas - Software', schedule: 'Lunes a viernes: 8:45 a. m. a 5:00 p. m.', isManager: false },
    ] as const;
    for (const member of team) {
      await prisma.teamMember.upsert({
        where: { id: member.id },
        update: member,
        create: member,
      });
    }

    const priorities = [
      { level: 'HIGH' as const, description: 'Interrupción de servicios importantes o problemas que afectan a varios usuarios.', activities: [{ categoryName: 'Sistemas y plataformas', activity: 'Caída de un servicio institucional crítico', estimate: 'Inmediato' }, { categoryName: 'Red e internet', activity: 'Incidente de seguridad o interrupción general del servicio', estimate: 'Inmediato' }] },
      { level: 'MEDIUM' as const, description: 'Fallas parciales que afectan a un usuario o a un área pequeña.', activities: [{ categoryName: 'Equipos y periféricos', activity: 'Fallas parciales de equipos o aplicaciones', estimate: '4 horas' }, { categoryName: 'Sistemas y plataformas', activity: 'Problemas que afectan a un usuario o área pequeña', estimate: '4 horas' }] },
      { level: 'LOW' as const, description: 'Consultas, instalaciones programadas y configuraciones sin impacto operativo.', activities: [{ categoryName: 'Software', activity: 'Instalaciones programadas', estimate: '1 día' }, { categoryName: 'Acceso y contraseñas', activity: 'Consultas generales sin impacto operativo', estimate: 'Según disponibilidad' }] },
    ];
    for (const level of priorities) {
      await prisma.priorityLevel.upsert({
        where: { level: level.level },
        update: { description: level.description },
        create: { level: level.level, description: level.description },
      });
      const existing = await prisma.priorityActivity.count({ where: { level: level.level } });
      if (existing === 0) {
        await prisma.priorityActivity.createMany({
          data: level.activities.map((activity) => ({ level: level.level, ...activity })),
        });
      }
    }
    console.info('Catálogo de Tickets listo: áreas, categorías, equipo y prioridades.');
  } finally {
    await prisma.$disconnect();
  }
};

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'No se pudo sembrar el catálogo de Tickets.');
  process.exitCode = 1;
});
