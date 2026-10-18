from app.prompts import tutor_instructions


def test_beginner_fluency_prompt_is_patient_and_contextual():
    prompt = tutor_instructions("beginner", "hr_interview", "fluency", "hinglish", "hr_interview")
    assert "one short question at a time" in prompt
    assert "Hinglish" in prompt
    assert "finish" in prompt
    assert "hr interview" in prompt


def test_prompt_does_not_treat_student_as_certified_exam():
    prompt = tutor_instructions("advanced", "workplace", "interview", "english", "project")
    assert "not a human or certified examiner" in prompt
    assert "do not invent" in prompt
