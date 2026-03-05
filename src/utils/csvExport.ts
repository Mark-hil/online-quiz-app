// CSV Export utility for student results

export interface StudentResult {
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
  timeTaken?: string;
}

export class CSVExporter {
  // Convert array of objects to CSV string
  private convertToCSV(data: any[], headers: string[]): string {
    const csvHeaders = headers.join(',');
    const csvRows = data.map(row => {
      return headers.map(header => {
        const value = row[header];
        // Handle special cases for CSV formatting
        if (value === null || value === undefined) return '';
        if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',');
    });
    
    return [csvHeaders, ...csvRows].join('\n');
  }

  // Download CSV file
  private downloadCSV(csvContent: string, filename: string): void {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  }

  // Export student results to CSV
  exportStudentResults(results: StudentResult[], quizTitle?: string): void {
    if (!results || results.length === 0) {
      alert('No data to export');
      return;
    }

    const headers = [
      'Student Name',
      'Student Email',
      'Quiz Title',
      'Subject',
      'Score',
      'Total Marks',
      'Percentage',
      'Status',
      'Submitted At',
      'Graded At',
      'Time Taken'
    ];

    const csvData = results.map(result => ({
      'Student Name': result.studentName || 'N/A',
      'Student Email': result.studentEmail || 'N/A',
      'Quiz Title': result.quizTitle || 'N/A',
      'Subject': result.subject || 'N/A',
      'Score': result.score !== null ? result.score : 'Not graded',
      'Total Marks': result.totalMarks || 0,
      'Percentage': typeof result.percentage === 'number' && !isNaN(result.percentage) 
        ? `${result.percentage.toFixed(2)}%` 
        : '0%',
      'Status': result.status || 'N/A',
      'Submitted At': result.submittedAt ? new Date(result.submittedAt).toLocaleString() : 'N/A',
      'Graded At': result.gradedAt ? new Date(result.gradedAt).toLocaleString() : 'Not graded',
      'Time Taken': result.timeTaken || 'N/A'
    }));

    const csvContent = this.convertToCSV(csvData, headers);
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const quizSuffix = quizTitle ? `_${quizTitle.replace(/[^a-zA-Z0-9]/g, '_')}` : '';
    const filename = `student_results${quizSuffix}_${timestamp}.csv`;
    
    this.downloadCSV(csvContent, filename);
  }

  // Export quiz summary to CSV
  exportQuizSummary(quizData: {
    title: string;
    subject: string;
    totalAttempts: number;
    averageScore: number;
    passRate: number;
    topScore: number;
    totalStudents: number;
    activeStudents: number;
  }): void {
    const headers = ['Metric', 'Value', 'Description'];
    
    const csvData = [
      {
        'Metric': 'Quiz Title',
        'Value': quizData.title,
        'Description': 'Name of the quiz'
      },
      {
        'Metric': 'Subject',
        'Value': quizData.subject,
        'Description': 'Subject area'
      },
      {
        'Metric': 'Total Attempts',
        'Value': quizData.totalAttempts,
        'Description': 'Number of times quiz was attempted'
      },
      {
        'Metric': 'Average Score',
        'Value': `${quizData.averageScore.toFixed(2)}%`,
        'Description': 'Average score across all attempts'
      },
      {
        'Metric': 'Pass Rate',
        'Value': `${quizData.passRate.toFixed(2)}%`,
        'Description': 'Percentage of students who passed (50%+)'
      },
      {
        'Metric': 'Top Score',
        'Value': `${quizData.topScore}%`,
        'Description': 'Highest score achieved'
      },
      {
        'Metric': 'Total Students',
        'Value': quizData.totalStudents,
        'Description': 'Total number of students in system'
      },
      {
        'Metric': 'Active Students',
        'Value': quizData.activeStudents,
        'Description': 'Students who attempted this quiz'
      }
    ];

    const csvContent = this.convertToCSV(csvData, headers);
    
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const quizTitle = quizData.title.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `quiz_summary_${quizTitle}_${timestamp}.csv`;
    
    this.downloadCSV(csvContent, filename);
  }
}

export const csvExporter = new CSVExporter();
