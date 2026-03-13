// PDF Export utility for exams and results
// Using jsPDF library for PDF generation

import jsPDF from 'jspdf';

export interface QuizQuestion {
  id: string;
  question_text: string;
  question_type: 'multiple-choice' | 'true-false' | 'short-answer' | 'essay';
  options?: string[];
  correct_answer?: string;
  marks: number;
}

export interface QuizData {
  title: string;
  description: string;
  subject: string;
  duration_minutes: number;
  total_marks: number;
  questions: QuizQuestion[];
  created_at: string;
  deadline?: string;
}

export interface StudentResultPDF {
  studentName: string;
  studentEmail: string;
  quizTitle: string;
  subject: string;
  score: number | null;
  totalMarks: number;
  percentage: number;
  status: string;
  submittedAt: string;
  gradedAt?: string;
  cheated?: boolean;
  cheatingReason?: string;
  tabSwitchCount?: number;
  copyAttempts?: number;
  rightClickCount?: number;
  answers: Array<{
    questionText: string;
    studentAnswer: string;
    correctAnswer?: string;
    marks: number;
    obtainedMarks: number;
    isCorrect: boolean;
  }>;
}

export class PDFExporter {
  private doc: jsPDF;
  private pageHeight: number;
  private pageWidth: number;
  private margin: number;
  private lineHeight: number;
  private currentY: number;

  constructor() {
    this.doc = new jsPDF();
    this.pageHeight = this.doc.internal.pageSize.height;
    this.pageWidth = this.doc.internal.pageSize.width;
    this.margin = 20;
    this.lineHeight = 7;
    this.currentY = this.margin;
  }

  // Add new page if needed
  private checkPageBreak(requiredHeight: number): void {
    if (this.currentY + requiredHeight > this.pageHeight - this.margin) {
      this.doc.addPage();
      this.currentY = this.margin;
    }
  }

  // Add text with word wrap
  private addText(text: string, fontSize: number = 12, fontStyle: string = 'normal'): void {
    this.doc.setFontSize(fontSize);
    this.doc.setFont('helvetica', fontStyle);
    
    const lines = this.doc.splitTextToSize(text, this.pageWidth - 2 * this.margin);
    
    lines.forEach((line: string) => {
      this.checkPageBreak(this.lineHeight);
      this.doc.text(line, this.margin, this.currentY);
      this.currentY += this.lineHeight;
    });
  }

  // Add header with title
  private addHeader(title: string, subtitle?: string): void {
    // Add title
    this.doc.setFontSize(20);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(title, this.pageWidth / 2, this.currentY, { align: 'center' });
    this.currentY += 15;

    if (subtitle) {
      this.doc.setFontSize(14);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text(subtitle, this.pageWidth / 2, this.currentY, { align: 'center' });
      this.currentY += 10;
    }

    // Add line
    this.doc.setDrawColor(200, 200, 200);
    this.doc.line(this.margin, this.currentY, this.pageWidth - this.margin, this.currentY);
    this.currentY += 10;
  }

  // Add quiz info table
  private addQuizInfo(quiz: QuizData): void {
    this.checkPageBreak(40);
    
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Quiz Information', this.margin, this.currentY);
    this.currentY += 10;

    const info = [
      ['Title:', quiz.title],
      ['Subject:', quiz.subject],
      ['Duration:', `${quiz.duration_minutes} minutes`],
      ['Total Marks:', quiz.total_marks.toString()],
      ['Questions:', quiz.questions.length.toString()],
      ['Created:', new Date(quiz.created_at).toLocaleDateString()],
      ['Deadline:', quiz.deadline ? new Date(quiz.deadline).toLocaleDateString() : 'No deadline']
    ];

    this.doc.setFontSize(11);
    this.doc.setFont('helvetica', 'normal');
    
    info.forEach(([label, value]) => {
      this.doc.text(label, this.margin, this.currentY);
      this.doc.text(value, this.margin + 40, this.currentY);
      this.currentY += 6;
    });

    this.currentY += 10;
  }

  // Add questions to PDF
  private addQuestions(questions: QuizQuestion[], includeAnswers: boolean = false): void {
    this.checkPageBreak(20);
    
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Questions', this.margin, this.currentY);
    this.currentY += 15;

    questions.forEach((question, index) => {
      this.checkPageBreak(40);

      // Question number and marks
      this.doc.setFontSize(12);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text(`Question ${index + 1} (${question.marks} marks)`, this.margin, this.currentY);
      this.currentY += 8;

      // Question text - handle empty or invalid text
      this.doc.setFont('helvetica', 'normal');
      const questionText = question.question_text && question.question_text.trim() 
        ? question.question_text 
        : '[No question text provided]';
      
      console.log(`Adding question ${index + 1}:`, questionText); // Debug log
      this.addText(questionText, 11);

      // Options for multiple choice
      if (question.question_type === 'multiple-choice' && question.options && Array.isArray(question.options)) {
        question.options.forEach((option, optIndex) => {
          this.checkPageBreak(10);
          const letter = String.fromCharCode(65 + optIndex); // A, B, C, D
          const optionText = option && option.trim() ? option : '[No option text]';
          this.doc.text(`${letter}. ${optionText}`, this.margin + 10, this.currentY);
          this.currentY += 6;
        });
      }

      // Handle true/false questions
      if (question.question_type === 'true-false') {
        this.checkPageBreak(10);
        this.doc.text('A. True', this.margin + 10, this.currentY);
        this.currentY += 6;
        this.doc.text('B. False', this.margin + 10, this.currentY);
        this.currentY += 6;
      }

      // Correct answer (for lecturer version)
      if (includeAnswers && question.correct_answer && question.correct_answer.trim()) {
        this.checkPageBreak(10);
        this.doc.setFont('helvetica', 'italic');
        this.doc.text(`Answer: ${question.correct_answer}`, this.margin, this.currentY);
        this.currentY += 8;
      }

      this.currentY += 5; // Space between questions
    });
  }

  // Export quiz to PDF
  exportQuiz(quiz: QuizData, includeAnswers: boolean = false): void {
    this.currentY = this.margin;

    // Add header
    this.addHeader(
      quiz.title,
      includeAnswers ? 'Quiz with Answers (Lecturer Copy)' : 'Quiz Paper (Student Copy)'
    );

    // Add quiz information
    this.addQuizInfo(quiz);

    // Add description if available
    if (quiz.description) {
      this.checkPageBreak(20);
      this.doc.setFontSize(12);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text('Description:', this.margin, this.currentY);
      this.currentY += 8;
      this.addText(quiz.description, 11);
    }

    // Add questions
    this.addQuestions(quiz.questions, includeAnswers);

    // Add footer
    this.addFooter();

    // Generate filename and download
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const quizTitle = quiz.title.replace(/[^a-zA-Z0-9]/g, '_');
    const suffix = includeAnswers ? '_with_answers' : '';
    const filename = `quiz_${quizTitle}${suffix}_${timestamp}.pdf`;

    this.doc.save(filename);
  }

  // Export student result to PDF
  exportStudentResult(result: StudentResultPDF): void {
    this.currentY = this.margin;

    // Add header
    this.addHeader(
      'Student Result Report',
      `${result.quizTitle} - ${result.studentName}`
    );

    // Add student information
    this.checkPageBreak(40);
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Student Information', this.margin, this.currentY);
    this.currentY += 10;

    const studentInfo = [
      ['Name:', result.studentName],
      ['Email:', result.studentEmail],
      ['Quiz:', result.quizTitle],
      ['Subject:', result.subject],
      ['Score:', `${result.score}/${result.totalMarks} (${result.percentage.toFixed(2)}%)`],
      ['Status:', result.status],
      ['Submitted:', new Date(result.submittedAt).toLocaleString()],
      ['Graded:', result.gradedAt ? new Date(result.gradedAt).toLocaleString() : 'Not graded']
    ];

    // Add cheating information if available
    if (result.cheated) {
      studentInfo.push(['Academic Integrity:', 'VIOLATION DETECTED']);
      if (result.cheatingReason && result.cheatingReason.trim()) {
        studentInfo.push(['Reason:', result.cheatingReason]);
      }
      if (result.tabSwitchCount !== undefined && result.tabSwitchCount > 0) {
        studentInfo.push(['Tab Switches:', result.tabSwitchCount.toString()]);
      }
      if (result.copyAttempts !== undefined && result.copyAttempts > 0) {
        studentInfo.push(['Copy Attempts:', result.copyAttempts.toString()]);
      }
      if (result.rightClickCount !== undefined && result.rightClickCount > 0) {
        studentInfo.push(['Right Clicks:', result.rightClickCount.toString()]);
      }
    } else {
      studentInfo.push(['Academic Integrity:', 'MAINTAINED']);
    }

    this.doc.setFontSize(11);
    this.doc.setFont('helvetica', 'normal');
    
    studentInfo.forEach(([label, value]) => {
      this.doc.text(label, this.margin, this.currentY);
      this.doc.text(value, this.margin + 40, this.currentY);
      this.currentY += 6;
    });

    // Add detailed answers
    this.currentY += 10;
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Detailed Answers', this.margin, this.currentY);
    this.currentY += 15;

    result.answers.forEach((answer, index) => {
      this.checkPageBreak(30);

      this.doc.setFontSize(12);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text(`Question ${index + 1} (${answer.marks} marks)`, this.margin, this.currentY);
      this.currentY += 8;

      // Question
      this.doc.setFont('helvetica', 'normal');
      this.addText(`Q: ${answer.questionText}`, 10);

      // Student answer
      this.addText(`A: ${answer.studentAnswer}`, 10);

      // Correct answer and marks
      if (answer.correctAnswer) {
        this.addText(`Correct: ${answer.correctAnswer}`, 10);
      }
      
      const resultText = `Marks: ${answer.obtainedMarks}/${answer.marks} (${answer.isCorrect ? 'Correct' : 'Incorrect'})`;
      this.addText(resultText, 10, answer.isCorrect ? 'bold' : 'normal');

      this.currentY += 5;
    });

    this.addFooter();

    // Generate filename and download
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const studentName = result.studentName.replace(/[^a-zA-Z0-9]/g, '_');
    const quizTitle = result.quizTitle.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `result_${studentName}_${quizTitle}_${timestamp}.pdf`;

    this.doc.save(filename);
  }

  // Add footer to PDF
  private addFooter(): void {
    const footerY = this.pageHeight - 15;
    
    this.doc.setFontSize(8);
    this.doc.setFont('helvetica', 'italic');
    this.doc.text(
      `Generated on ${new Date().toLocaleString()} by Quiz Management System`,
      this.pageWidth / 2,
      footerY,
      { align: 'center' }
    );

    // Add page numbers
    const pageNumber = this.doc.internal.getCurrentPageInfo().pageNumber;
    const totalPages = this.doc.internal.getNumberOfPages();
    this.doc.text(
      `Page ${pageNumber} of ${totalPages}`,
      this.pageWidth - this.margin,
      footerY,
      { align: 'right' }
    );
  }
}

export const pdfExporter = new PDFExporter();
