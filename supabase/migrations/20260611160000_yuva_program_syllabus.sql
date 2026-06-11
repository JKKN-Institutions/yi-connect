-- Yi Youth Academy — program-level syllabus attachment (spec Known Issue P3).
-- A National admin attaches ONE syllabus document per program (private
-- yuva-materials bucket, program/{id}/syllabus.{ext}). Enrolled students
-- download it via a short-lived signed URL.
ALTER TABLE yuva.programs ADD COLUMN syllabus_storage_path text;
