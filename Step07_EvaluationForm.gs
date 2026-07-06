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
  form.setTitle('تقييم تجربة التدريب / Training Evaluation');
  form.setDescription('يرجى تقييم تجربة التدريب بعد انتهاء التدريب.\nPlease evaluate the training experience after the placement ends.');
  try { form.setCollectEmail(true); } catch (ignore) {}
  try { form.setAllowResponseEdits(false); } catch (ignore2) {}
  try { form.setConfirmationMessage('شكراً لك. تم استلام التقييم. / Thank you. Your evaluation has been received.'); } catch (ignore3) {}

  if (BOOTSTRAP_CONFIG.REBUILD_EVALUATION_FORM_ITEMS) deleteAllFormItems_(form);

  ensureText_(form, 'رقم الطلب / Request ID', true);
  ensureText_(form, 'اسم الموظف / Employee Name', true);
  var rating = ensureList_(form, 'التقييم العام / Overall Rating', true);
  rating.setChoiceValues([
    '5 - ممتاز / Excellent',
    '4 - جيد جداً / Very Good',
    '3 - جيد / Good',
    '2 - مقبول / Fair',
    '1 - ضعيف / Poor'
  ]);
  ensureParagraph_(form, 'ما أكثر شيء كان مفيداً؟ / What was most useful?', false);
  ensureParagraph_(form, 'ما الذي يمكن تحسينه؟ / What can be improved?', false);
  ensureParagraph_(form, 'ملاحظات إضافية / Additional Comments', false);
}
