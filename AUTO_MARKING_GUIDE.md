# Auto-Marking System - Implementation Guide

## Overview

The Quiz Management System now features a comprehensive auto-marking system for objective questions (MCQ and True/False). This document explains how the system works and how to use it.

## Key Features Implemented

### 1. Enhanced Question Creation Form (Lecturer)

#### Multiple Choice (MCQ) Questions
- Each option now has a dedicated radio button to mark it as the correct answer
- Visual feedback: Selected correct answer is highlighted in green
- Validation ensures:
  - At least 2 options are provided
  - Exactly one option is marked as correct
  - Question text is provided
- Error messages guide lecturers through the process

#### True/False Questions
- Two large, clickable radio buttons for True/False selection
- Visual highlighting when correct answer is selected (green border)
- Validation ensures a correct answer is selected before saving

#### Essay Questions
- No correct answer selection required at question creation time
- Lecturers can optionally provide an expected answer when grading submissions

### 2. Quiz Publishing Validation

Before a quiz can be published, the system validates:
- Quiz has a title
- Quiz has at least one question
- All MCQ questions have a selected correct answer
- All True/False questions have a selected correct answer
- Essay questions do NOT require a correct answer at creation time

Error messages appear if validation fails, preventing publication of incomplete quizzes.

### 3. Auto-Grading on Submission

When a student submits a quiz:

#### Automatic Processing
1. **MCQ Questions**: System compares student's selected option against the correct answer
   - Match = Full marks awarded
   - No match = 0 marks awarded
   - Instantly graded

2. **True/False Questions**: System compares student's response against correct answer
   - Match = Full marks awarded
   - No match = 0 marks awarded
   - Instantly graded

3. **Essay Questions**: Marked as pending
   - Awaits lecturer manual grading
   - Can be auto-graded if lecturer provides expected answer during grading

#### Score Calculation
- Total score = Sum of marks from all questions
- Percentage = (Total Score / Total Possible Marks) × 100
- Automatically saved to database

### 4. Student Results View

Students can see their quiz results with:
- **Objective Questions Display**:
  - Correct answers shown in green box
  - Incorrect answers shown in red box
  - Clear visual indicator of right/wrong

- **Answer Comparison**:
  - Student's answer displayed
  - Correct answer shown for reference

- **Score Breakdown**:
  - Overall percentage score
  - Marks obtained per question
  - Marks possible per question

### 5. Lecturer Grading Interface

Lecturers can:
- View auto-graded MCQ and True/False questions (locked/finalized)
- See visual indicators showing if answers are correct or incorrect
- For essay questions:
  - Enter expected/model answer for comparison
  - System will auto-calculate if student's answer matches model answer
  - Manually adjust marks if needed
  - Add detailed comments and feedback

### 6. Smart Grading with Model Answers

For essay questions, lecturers can:
1. Enter the expected/model answer
2. System automatically compares student's answer against model answer
3. If it matches: full marks awarded, marked as "correct"
4. If it doesn't match: marks field available for manual assignment
5. Add feedback comments to guide students

## User Workflows

### Lecturer Workflow

1. **Create Quiz**
   ```
   → Create Quiz
   → Add Questions (select correct answers for objective questions)
   → System validates all questions have correct answers
   → Click "Publish Quiz"
   → Quiz available to students
   ```

2. **Review Submissions**
   ```
   → View Submissions
   → Click on student submission
   → See auto-graded objective questions (marked correct/incorrect)
   → For essays:
      - Enter expected answer OR manually assign marks
      - Add comments
   → Click "Save Grades"
   → Student can now view results
   ```

### Student Workflow

1. **Take Quiz**
   ```
   → Browse Available Quizzes
   → Click "Start Quiz"
   → Answer questions (no correct answers visible during quiz)
   → Navigate using Previous/Next or question palette
   → Mark questions for review if needed
   → Submit Quiz
   ```

2. **View Results**
   ```
   → Go to My Attempts
   → Click graded attempt
   → See:
      - Overall percentage score
      - Each question with their answer
      - Correct answers for comparison
      - Lecturer feedback (if provided)
   ```

## Technical Details

### Data Storage

Questions table includes:
```
- question_text: The question
- question_type: 'mcq', 'true_false', or 'essay'
- options: JSON array of options (for MCQ)
- correct_answer: The correct answer value
- marks: Points for this question
```

Student Answers table includes:
```
- answer_text: What the student answered
- is_correct: Boolean (auto-set for objective questions)
- marks_obtained: Points awarded (auto-set for objective, manual for essay)
- lecturer_comment: Feedback from lecturer
```

Quiz Attempts table includes:
```
- score: Final percentage (calculated and stored)
- status: 'in_progress', 'submitted', or 'graded'
- submitted_at: When student submitted
```

### Auto-Grading Logic

MCQ and True/False questions are auto-graded immediately upon submission:

```javascript
for (const question of questions) {
  const answer = answers[question.id];

  if (question.question_type !== 'essay') {
    const isCorrect = answer === question.correct_answer;
    const marksObtained = isCorrect ? question.marks : 0;

    // Store in database
    update student_answers set
      is_correct = isCorrect,
      marks_obtained = marksObtained
  }
}

// Calculate and store total score
totalMarks = sum of all marks_obtained
percentage = (totalMarks / total_possible) * 100
```

## Visual Indicators

### During Question Creation
- **MCQ**: Green border around selected correct option
- **True/False**: Green border around selected correct answer
- **Status**: Shows "Correct answer: ✓ Selected" or "(select one)"

### In Results View
- **Correct Answer**: Green background box with darker green text
- **Incorrect Answer**: Red background box with darker red text
- **Checkmark Icon**: Green ✓ for correct answers
- **X Icon**: Red ✗ for incorrect answers

### In Submission Grading
- **Auto-graded Questions**: Read-only, locked appearance
- **Essay Questions**: Editable marks field
- **Model Answer Field**: Shows if expected answer is provided

## Validation & Error Handling

### Question Creation Validation
- Minimum 2 options for MCQ
- Exactly 1 correct answer selected
- Non-empty question text
- Valid marks > 0

### Quiz Publishing Validation
- Title is required
- At least 1 question
- ALL objective questions have correct answer selected
- Clear error messages if validation fails

### Submission Processing
- Automatic grading happens silently
- If timer expires, auto-submission triggers
- All data persisted to database
- Student cannot modify after submission

## Future Enhancements

Potential improvements:
1. Partial credit for MCQ (specify points for each option)
2. Case-insensitive essay comparison
3. Fuzzy matching for essay answers
4. Keyword-based essay grading
5. Question difficulty analytics
6. Performance comparison to class average
7. Time spent per question analysis
8. Question randomization per student

## Troubleshooting

### Issue: "Please select the correct answer" error
**Solution**: Make sure you click the radio button next to the correct option before clicking "Add Question"

### Issue: Can't publish quiz
**Solution**: Ensure all MCQ and True/False questions have a correct answer selected. Essay questions don't need one.

### Issue: Student sees correct answer during quiz
**Solution**: This shouldn't happen. Correct answers are hidden in the quiz interface and only shown after submission.

### Issue: Score not calculating correctly
**Solution**: Verify that all question marks are integers and add up correctly. The system totals automatically.

## Summary

The auto-marking system provides:
- ✓ Instant grading for objective questions
- ✓ Validation to prevent incomplete quizzes
- ✓ Clear visual feedback during creation
- ✓ Student-friendly results display
- ✓ Flexible essay grading with model answers
- ✓ Comprehensive scoring and analytics
- ✓ Automatic data persistence

This system significantly reduces grading workload for lecturers while providing immediate feedback to students on objective questions.
