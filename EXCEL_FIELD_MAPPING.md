# Exact Excel-to-database mapping

Contract version MPS-SCHOOL-1. Headers at row4; records from row5. Names/case must match exactly; columns may be reordered. All columns required, only account_alias value may be empty.00_START_HERE and09_VALIDATION_REFERENCE are required reference sheets and never imported as data.

## 01_SCHOOL

| Workbook field | Destination / rule |
|---|---|
| `school_name` | _STATE school-profile → SCHOOL_NAME after commit |
| `academic_year` | must equal current config year; cannot switch database/year |
| `headmistress_name` | _STATE school-profile → HEADMISTRESS_NAME after commit |
| `grading_version` | validated existing GRADE_RULES version; profile reference |
| `template_version` | replacement-v1 profile reference |

## 02_CLASSES

| Workbook field | Destination / rule |
|---|---|
| `class_id` | CLASSES.class_id |
| `class_name` | CLASSES.class_name |
| `academic_year` | CLASSES.academic_year |
| `year_level` | CLASSES.year_level |
| `active` | CLASSES.active |

## 03_STUDENTS

| Workbook field | Destination / rule |
|---|---|
| `student_id` | STUDENTS.student_id and ENROLMENTS.student_id (text) |
| `full_name` | STUDENTS.full_name |
| `class_id` | ENROLMENTS.class_id |
| `start_date` | ENROLMENTS.start_date (normalized ISO) |
| `student_status` | STUDENTS.student_status |
| `enrolment_status` | ENROLMENTS.status |

## 04_TEACHERS

| Workbook field | Destination / rule |
|---|---|
| `teacher_ref` | _STATE school-teacher hash → USERS.user_id; stable relationship key |
| `full_name` | USERS.full_name |
| `identification_code` | USERS.identification_code (six-digit text) |
| `account_alias` | USERS.account_alias; blank allowed |
| `active` | USERS.active; existing active accounts cannot be deactivated by import |
| `role` | USERS.roles JSON, CLASS_TEACHER/SUBJECT_TEACHER only; existing roles retained |

## 05_CLASS_TEACHERS

| Workbook field | Destination / rule |
|---|---|
| `class_id` | ASSIGNMENTS.class_id |
| `teacher_ref` | resolved USERS.user_id → ASSIGNMENTS.user_id |
| `academic_year` | ASSIGNMENTS.academic_year (must current) |
| `active` | ASSIGNMENTS.active; assignment_type=CLASS_TEACHER, subject_code empty |

## 06_SUBJECT_ASSIGNMENTS

| Workbook field | Destination / rule |
|---|---|
| `class_id` | ASSIGNMENTS.class_id |
| `subject_code` | ASSIGNMENTS.subject_code, offered for class year |
| `teacher_ref` | resolved USERS.user_id → ASSIGNMENTS.user_id |
| `academic_year` | ASSIGNMENTS.academic_year (must current) |
| `active` | ASSIGNMENTS.active; assignment_type=SUBJECT_TEACHER |

## 07_SUBJECTS

| Workbook field | Destination / rule |
|---|---|
| `subject_code` | SUBJECTS.subject_code |
| `subject_name` | SUBJECTS.subject_name |
| `offered_year_levels` | SUBJECTS.offered_year_levels |
| `display_order` | SUBJECTS.display_order |
| `default_status` | SUBJECTS.default_status |
| `active` | SUBJECTS.active |

## 08_EXAMS

| Workbook field | Destination / rule |
|---|---|
| `academic_year` | EXAMS.academic_year |
| `exam_type` | EXAMS.exam_type |
| `opening_date` | EXAMS.opening_date |
| `closing_date` | EXAMS.closing_date |
| `grading_version` | EXAMS.grading_version |
| `template_version` | EXAMS.template_version |
| `intended_status` | _STATE school-intent:<exam_id>; new EXAMS.status always DRAFT |

## Derived values and matching

CLASSES.academic_stage is1 for Years1–3 and2 for4–6. Stable internal IDs for new users, enrolments, assignments and exams use setupId_ hashes. Existing identifiers are retained when exact safe matches exist; no display BIL/name matching. Timestamps/auth_version are managed by backend. Enrolment year comes from the active class/year; end_date is retained or blank when unknown. Missing worksheet records never delete database records.

Subject matching uses all14 codes from Config.js: BM,BI,MM,SN,PI,PM,BA,BC,BT,PJPK,MZ,PSV,SEJ,RBT. First12 cover Years1–6; SEJ/RBT cover4–6. PI/PM/BA/BC/BT default TB, all others EMPTY. No grade bands are supplied/replaced by workbook; existing rules are validated.

Teacher identity is exact six-digit text+alias, anchored by stable teacher_ref mapping when present. Permanent credentials are retained. Only new teachers receive a must_change temporary verifier; no PIN/proof/code/token field is accepted in workbook. Existing roles are retained, with authorized teacher roles added; role order alone does not revoke sessions.

Class-teacher assignment matching is year+class+type and must retain the current teacher. Subject-teacher tuples include teacher user_id; extra authorized co-teaching rows add assignments rather than replacing/deleting prior ones. Changes to existing enrolment class/start/status and prepared exam configuration are rejected.

Preview/create/update/skip counts are per core table. State metadata changes are included in overall change_count rather than inventing a core table. Row/field conflicts are reported separately; cross-record checks may show field * with the offending rule in the message. Conflicting imports cannot partially commit.
