import { Router } from 'express';
import type { z } from 'zod';
import {
  type AuthRequest,
  authMiddleware,
} from '../../common/middleware/auth.js';
import { uploadPhotos } from '../../common/middleware/upload.js';
import { validate } from '../../common/middleware/validate.js';
import {
  photoParamsSchema,
  uuidParamsSchema,
} from '../../common/schemas/common.js';
import { docGenerationLimiter } from './docGenerationLimiter.js';
import {
  autosaveSchema,
  createReportSchema,
  photoPatchSchema,
  reportsQuerySchema,
  type Step4Input,
  step2Schema,
  step3Schema,
  step4Schema,
  step5Schema,
} from './reports.schemas.js';
import { reportService } from './reports.service.js';

const router = Router();

function getCreatorId(req: AuthRequest) {
  return req.creator!.id;
}

router.post(
  '/',
  authMiddleware,
  validate({ body: createReportSchema }),
  async (req: AuthRequest, res) => {
    const data = req.body as z.infer<typeof createReportSchema>;
    const result = await reportService.createReport(getCreatorId(req), data);
    res.status(201).json(result);
  },
);

router.patch(
  '/:id/step-2',
  authMiddleware,
  validate({ params: uuidParamsSchema, body: step2Schema }),
  async (req: AuthRequest, res) => {
    await reportService.saveStep2(
      req.params.id as string,
      getCreatorId(req),
      req.body,
    );
    res.json({ message: 'Step 2 saved' });
  },
);

router.patch(
  '/:id/step-3',
  authMiddleware,
  validate({ params: uuidParamsSchema, body: step3Schema }),
  async (req: AuthRequest, res) => {
    await reportService.saveStep3(
      req.params.id as string,
      getCreatorId(req),
      req.body,
    );
    res.json({ message: 'Step 3 saved' });
  },
);

router.patch(
  '/:id/step-4',
  authMiddleware,
  validate({ params: uuidParamsSchema, body: step4Schema }),
  async (req: AuthRequest, res) => {
    await reportService.saveStep4(
      req.params.id as string,
      getCreatorId(req),
      req.body as Step4Input,
    );
    res.json({ message: 'Step 4 saved' });
  },
);

router.patch(
  '/:id/step-5',
  authMiddleware,
  validate({ params: uuidParamsSchema, body: step5Schema }),
  async (req: AuthRequest, res) => {
    await reportService.saveStep5(req.params.id as string, getCreatorId(req));
    res.json({ message: 'Step 5 saved' });
  },
);

router.patch(
  '/:id/autosave',
  authMiddleware,
  validate({ params: uuidParamsSchema, body: autosaveSchema }),
  async (req: AuthRequest, res) => {
    const { version } = await reportService.autosave(
      req.params.id as string,
      getCreatorId(req),
      req.body as Record<string, unknown>,
    );
    res.json({ saved_at: new Date().toISOString(), version });
  },
);

router.get(
  '/',
  authMiddleware,
  validate({ query: reportsQuerySchema }),
  async (req: AuthRequest, res) => {
    const query = req.query as unknown as z.infer<typeof reportsQuerySchema>;
    const result = await reportService.listReports(getCreatorId(req), query);
    res.json(result);
  },
);

router.get(
  '/:id',
  authMiddleware,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res) => {
    const result = await reportService.getFullReport(
      getCreatorId(req),
      req.params.id as string,
    );
    res.json(result);
  },
);

router.delete(
  '/:id',
  authMiddleware,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res) => {
    await reportService.deleteReport(
      req.params.id as string,
      getCreatorId(req),
    );
    res.json({ message: 'Draft deleted' });
  },
);

router.post(
  '/:id/finalize-and-generate',
  authMiddleware,
  docGenerationLimiter,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res) => {
    const result = await reportService.finalizeAndGenerate(
      getCreatorId(req),
      req.params.id as string,
    );
    res.json(result);
  },
);

router.get(
  '/:id/download',
  authMiddleware,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res) => {
    const { filePath, filename } = await reportService.getDownloadPath(
      getCreatorId(req),
      req.params.id as string,
    );
    res.download(filePath, filename);
  },
);

router.post(
  '/:id/photos',
  authMiddleware,
  validate({ params: uuidParamsSchema }),
  uploadPhotos,
  async (req: AuthRequest, res) => {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    const result = await reportService.uploadPhotos(
      getCreatorId(req),
      req.params.id as string,
      files,
    );
    res.json(result);
  },
);

router.delete(
  '/:id/photos/:photoId',
  authMiddleware,
  validate({ params: photoParamsSchema }),
  async (req: AuthRequest, res) => {
    await reportService.deletePhoto(
      getCreatorId(req),
      req.params.id as string,
      req.params.photoId as string,
    );
    res.json({ message: 'Photo deleted' });
  },
);

router.patch(
  '/:id/photos/:photoId',
  authMiddleware,
  validate({ params: photoParamsSchema, body: photoPatchSchema }),
  async (req: AuthRequest, res) => {
    const result = await reportService.patchPhoto(
      req.params.photoId as string,
      req.params.id as string,
      getCreatorId(req),
      req.body as z.infer<typeof photoPatchSchema>,
    );
    res.json(result);
  },
);

router.get(
  '/:id/photos',
  authMiddleware,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res) => {
    const result = await reportService.listPhotos(
      getCreatorId(req),
      req.params.id as string,
    );
    res.json(result);
  },
);

router.get(
  '/:id/photos/:photoId/file',
  authMiddleware,
  validate({ params: photoParamsSchema }),
  async (req: AuthRequest, res) => {
    const filePath = await reportService.getPhotoFile(
      getCreatorId(req),
      req.params.id as string,
      req.params.photoId as string,
    );
    res.sendFile(filePath);
  },
);

export default router;
