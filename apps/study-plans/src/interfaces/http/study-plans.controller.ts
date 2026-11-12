import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { RouteConfig } from '@nestjs/platform-fastify';

import { StudyPlansService } from '../../application/study-plans.service.js';
import { CreateCurriculumDto, CreateCycleDto, SaveCourseDto, UploadSyllabusDto } from './dto/study-plans.dto.js';
import { CurrentActor, StudyPlansSessionGuard, type StudyPlansActor } from './study-plans-session.js';

@Controller('study-plans')
@UseGuards(StudyPlansSessionGuard)
export class StudyPlansController {
  constructor(private readonly plans: StudyPlansService) {}

  @Get('catalog')
  catalog(@CurrentActor() actor: StudyPlansActor) {
    return this.plans.catalog(actor);
  }

  @Get('curricula')
  curricula(
    @CurrentActor() actor: StudyPlansActor,
    @Query('careerId', ParseUUIDPipe) careerId: string,
    @Query('modalityId', ParseUUIDPipe) modalityId: string,
  ) {
    return this.plans.listCurricula(actor, careerId, modalityId);
  }

  @Post('curricula')
  @HttpCode(201)
  createCurriculum(@CurrentActor() actor: StudyPlansActor, @Body() body: CreateCurriculumDto) {
    return this.plans.createCurriculum(actor, body);
  }

  @Get('curricula/:id')
  curriculum(@CurrentActor() actor: StudyPlansActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.plans.curriculum(actor, id);
  }

  @Post('curricula/:id/activate')
  activate(@CurrentActor() actor: StudyPlansActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.plans.setStatus(actor, id, 'ACTIVE');
  }

  @Post('curricula/:id/deactivate')
  deactivate(@CurrentActor() actor: StudyPlansActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.plans.setStatus(actor, id, 'INACTIVE');
  }

  @Post('curricula/:id/cycles')
  @HttpCode(201)
  addCycle(@CurrentActor() actor: StudyPlansActor, @Param('id', ParseUUIDPipe) id: string, @Body() body: CreateCycleDto) {
    return this.plans.addCycle(actor, id, body.number);
  }

  @Delete('cycles/:id')
  @HttpCode(204)
  removeCycle(@CurrentActor() actor: StudyPlansActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.plans.removeCycle(actor, id);
  }

  @Post('cycles/:id/courses')
  @HttpCode(201)
  addCourse(@CurrentActor() actor: StudyPlansActor, @Param('id', ParseUUIDPipe) id: string, @Body() body: SaveCourseDto) {
    return this.plans.addCourse(actor, id, body);
  }

  @Patch('courses/:id')
  updateCourse(@CurrentActor() actor: StudyPlansActor, @Param('id', ParseUUIDPipe) id: string, @Body() body: SaveCourseDto) {
    return this.plans.updateCourse(actor, id, body);
  }

  @Delete('courses/:id')
  @HttpCode(204)
  removeCourse(@CurrentActor() actor: StudyPlansActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.plans.removeCourse(actor, id);
  }

  @Post('courses/:id/syllabus')
  @RouteConfig({ rateLimit: { max: 10, timeWindow: '1 minute' } })
  upload(@CurrentActor() actor: StudyPlansActor, @Param('id', ParseUUIDPipe) id: string, @Body() body: UploadSyllabusDto) {
    return this.plans.uploadSyllabus(actor, id, body.contentBase64);
  }

  @Delete('courses/:id/syllabus')
  @HttpCode(204)
  retire(@CurrentActor() actor: StudyPlansActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.plans.retireSyllabus(actor, id);
  }

  @Get('courses/:id/syllabus')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Cache-Control', 'no-store')
  async file(@CurrentActor() actor: StudyPlansActor, @Param('id', ParseUUIDPipe) id: string): Promise<StreamableFile> {
    const file = await this.plans.syllabusFile(actor, id);
    return new StreamableFile(Buffer.from(file.content), {
      type: 'application/pdf',
      disposition: `inline; filename="silabo-${file.code}.pdf"`,
    });
  }
}
