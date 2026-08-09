function run07_setupEvaluationForm() {
  var ss = openDashboardFromProperties_();
  var form = openEvaluationFormFromProperties_();
  rebuildEvaluationForm_(form);
  setBootstrapProperties_({
    [BSPROP.EVALUATION_FORM_ID]: form.getId(),
    [BSPROP.EVALUATION_FORM_EDIT_URL]: form.getEditUrl(),
    [BSPROP.EVALUATION_FORM_PUBLISHED_URL]: form.getPublishedUrl()
  });
  writeSettings_(ss, tryOpenMainForm_(), form);
  writeSetupSummary_(ss, tryOpenMainForm_(), form);
  return finishStep_('07 Setup Evaluation Form', BSTATUS.COMPLETE, 'Evaluation form is ready.');
}

function rebuildEvaluationForm_(form) {
  form.setTitle('نموذج استبانة تقييم تجربة التدوير المعرفي للموظفين الجدد (التغذية الراجعة) / New Employee Knowledge Rotation Experience Evaluation Form (Feedback)');
  form.setDescription('يرجى تعبئة الاستبانة بعد انتهاء البرنامج. / Please complete this evaluation after the program ends.');
  try { form.setCollectEmail(true); } catch (ignore) {}
  try { form.setAllowResponseEdits(false); } catch (ignore2) {}
  try { form.setProgressBar(true); } catch (ignoreProgress) {}
  try { form.setConfirmationMessage('شكراً لك. تم استلام التقييم. / Thank you. Your evaluation has been received.'); } catch (ignore3) {}

  if (BOOTSTRAP_CONFIG.REBUILD_EVALUATION_FORM_ITEMS) deleteAllFormItems_(form);

  addEvaluationSection_(form, 'نموذج استبانة تقييم تجربة التدوير المعرفي للموظفين الجدد (التغذية الراجعة) / New Employee Knowledge Rotation Experience Evaluation Form (Feedback)');
  addEvaluationSection_(form, 'أولاً: بيانات الموظف / First: Employee Information');
  ensureText_(form, EVALUATION_FIELDS.REQUEST_ID, true);
  ensureText_(form, EVALUATION_FIELDS.REQUEST_GROUP_ID, true);
  ensureText_(form, EVALUATION_FIELDS.SELECTION_NUMBER, true);
  ensureText_(form, EVALUATION_FIELDS.EMPLOYEE_NAME, true);
  ensureText_(form, EVALUATION_FIELDS.EMPLOYEE_ID, true);
  ensureText_(form, EVALUATION_FIELDS.JOB_TITLE, true);

  addEvaluationSection_(form, 'تفاصيل التدوير المحدد (تعبأ تلقائياً) / Selected Rotation Details (Automatically Prefilled)');
  ensureText_(form, EVALUATION_FIELDS.ROTATION_UNIT, true);
  ensureText_(form, EVALUATION_FIELDS.ROTATION_SECTION, true);
  ensureText_(form, EVALUATION_FIELDS.START_DATE, true);
  ensureText_(form, EVALUATION_FIELDS.END_DATE, true);
  ensureText_(form, EVALUATION_FIELDS.DAILY_HOURS, true);
  ensureText_(form, EVALUATION_FIELDS.WORKING_DAYS, true);
  ensureText_(form, EVALUATION_FIELDS.TOTAL_HOURS, true);
  ensureText_(form, EVALUATION_FIELDS.PARTICIPATION_DURATION, true);

  addEvaluationSection_(form, 'ثانياً: تقييم البرنامج / Second: Program Evaluation');
  addEvaluationSection_(form, 'مقياس التقييم / Rating scale: (1 = ضعيف جداً / Very Poor | 2 = ضعيف / Poor | 3 = متوسط / Average | 4 = جيد / Good | 5 = ممتاز / Excellent)');
  addEvaluationGrid_(form, 'التهيئة والتدوير المعرفي / Orientation and Knowledge Rotation', [
    'وضوح برنامج التهيئة في بداية التوظيف / Clarity of the orientation program at the start of employment',
    'جودة التدوير المعرفي على الأنظمة والإجراءات / Quality of knowledge rotation on systems and procedures',
    'مدى استفادتي من مرحلة التهيئة / How much I benefited from the orientation phase'
  ], true);
  addEvaluationGrid_(form, 'التدوير داخل الوحدة / Rotation Within the Unit', [
    'وضوح المهام في كل قسم / Clarity of tasks in each section',
    'تعاون الأقسام أثناء فترة التدوير / Cooperation of sections during the rotation period',
    'اكتساب مهارات جديدة خلال التدوير / Gaining new skills during rotation',
    'مدى استفادتي من هذه المرحلة / How much I benefited from this phase'
  ], true);
  addEvaluationGrid_(form, 'التدوير خارج الوحدة / Rotation Outside the Unit', [
    'أهمية الأقسام التي تم التدوير إليها / Relevance of the sections rotated to',
    'مدى ارتباط التدوير بطبيعة عملي / Connection of the rotation to my work nature',
    'مستوى الفائدة المكتسبة / Level of benefit gained'
  ], true);
  addEvaluationGrid_(form, 'الإشراف والمتابعة / Supervision and Follow-up', [
    'دعم المشرف المباشر خلال البرنامج / Direct supervisor support during the program',
    'وضوح التوجيهات والتعليمات / Clarity of guidance and instructions',
    'توفر المساندة عند الحاجة / Availability of support when needed'
  ], true);

  ensurePage_(form, 'التقييم العام والأسئلة المفتوحة / General Evaluation and Open Questions');
  addEvaluationGrid_(form, 'التقييم العام / General Evaluation', [
    'مدى رضاك العام عن البرنامج / Your overall satisfaction with the program',
    'مدى مساهمة البرنامج في سرعة اندماجك / Program contribution to your speed of integration',
    'مدى تعزيز فهمك لإجراءات العمل / Program enhancement of your understanding of work procedures'
  ], true);
  addEvaluationSection_(form, 'ثالثاً: أسئلة مفتوحة / Third: Open Questions');
  ensureParagraph_(form, '1. ما أكثر مرحلة استفدت منها في البرنامج؟ ولماذا؟ / Which phase of the program benefited you the most? Why?', false);
  ensureParagraph_(form, '2. ما أبرز التحديات التي واجهتك خلال البرنامج؟ / What were the main challenges you faced during the program?', false);
  ensureParagraph_(form, '3. ما المقترحات التي تراها لتحسين البرنامج؟ / What suggestions do you have to improve the program?', false);
  addEvaluationMultipleChoice_(form, '4. هل ترى أن مدة البرنامج مناسبة؟ / Do you think the program duration is suitable?', ['نعم / Yes', 'لا / No'], false);
  ensureParagraph_(form, 'إذا كانت لا، ما المقترح؟ / If no, what do you suggest?', false);

  ensurePage_(form, 'تقييم الجاهزية والتوصيات الإضافية / Readiness Evaluation and Additional Recommendations');
  addEvaluationSection_(form, 'رابعاً: تقييم الجاهزية / Fourth: Readiness Evaluation');
  addEvaluationMultipleChoice_(form, 'هل تشعر أنك أصبحت جاهزاً لأداء مهام وظيفتك بكفاءة بعد البرنامج؟ / Do you feel ready to perform your job duties efficiently after the program?', ['نعم / Yes', 'إلى حد ما / To some extent', 'لا / No'], false);
  addEvaluationSection_(form, 'خامساً: توصيات إضافية (اختياري) / Fifth: Additional Recommendations (Optional)');
  ensureParagraph_(form, 'توصيات إضافية (اختياري) / Additional recommendations (optional)', false);
}

function addEvaluationSection_(form, title) {
  return form.addSectionHeaderItem().setTitle(title);
}

function addEvaluationGrid_(form, title, rows, required) {
  return form.addGridItem()
    .setTitle(title)
    .setRows(rows)
    .setColumns(['5', '4', '3', '2', '1'])
    .setRequired(Boolean(required));
}

function addEvaluationMultipleChoice_(form, title, choices, required) {
  return form.addMultipleChoiceItem()
    .setTitle(title)
    .setChoiceValues(choices)
    .setRequired(Boolean(required));
}
