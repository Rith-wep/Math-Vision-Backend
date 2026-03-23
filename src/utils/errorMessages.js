const ERROR_MESSAGE_MAP = new Map([
  ["Internal server error.", "មានបញ្ហាខាងម៉ាស៊ីនមេ។ សូមព្យាយាមម្តងទៀត។"],
  ["Route not found.", "រកមិនឃើញទំព័រ ឬសេវាកម្មដែលបានស្នើទេ។"],
  ["Gemini did not return a valid JSON object.", "មិនអាចដំណើរការចម្លើយពីប្រព័ន្ធ AI បានទេ។ សូមព្យាយាមម្តងទៀត។"],
  ["GEMINI_API_KEY is missing in the backend environment.", "សេវាដោះស្រាយបញ្ហាគណិតកំពុងមានបញ្ហាបណ្ដោះអាសន្ន។"],
  ["Image data is missing.", "មិនមានទិន្នន័យរូបភាពសម្រាប់ស្កេនទេ។"],
  ["Unable to extract a math problem from the image.", "មិនអាចអានលំហាត់គណិតពីរូបភាពនេះបានទេ។ សូមសាករូបភាពថ្មី។"],
  ["Image file is required for scanning.", "សូមជ្រើសរើសរូបភាពមួយសម្រាប់ស្កេន។"],
  ["No readable math text was detected in the image.", "មិនបានរកឃើញអត្ថបទគណិតដែលអាចអានបានក្នុងរូបភាពទេ។"],
  ["Quiz subject not found.", "រកមិនឃើញមុខវិជ្ជាសំណួរនេះទេ។"],
  ["Quiz level not found.", "រកមិនឃើញកម្រិតសំណួរនេះទេ។"],
  ["Previous quiz level must be completed with at least 80% first.", "សូមបញ្ចប់កម្រិតមុនឱ្យបានយ៉ាងតិច ៨០% ជាមុនសិន។"],
  ["User not found.", "រកមិនឃើញគណនីអ្នកប្រើប្រាស់ទេ។"],
  ['The field "title_kh" is required.', "សូមបំពេញចំណងជើងជាភាសាខ្មែរ។"],
  ['The field "description_kh" is required.', "សូមបំពេញសេចក្ដីពិពណ៌នាជាភាសាខ្មែរ។"],
  ['The field "latex_content" is required.', "សូមបំពេញមាតិការូបមន្ត។"],
  ['The field "category" is required.', "សូមជ្រើសរើសប្រភេទ។"],
  ['The field "grade" is required.', "សូមបំពេញកម្រិតថ្នាក់។"],
  ["Google account did not return an email address.", "គណនី Google មិនបានផ្ដល់អ៊ីមែលត្រឡប់មកវិញទេ។"],
  ["Full name is required.", "សូមបំពេញឈ្មោះពេញ។"],
  ["Email is required.", "សូមបំពេញអ៊ីមែល។"],
  ["Password must be at least 6 characters long.", "លេខសម្ងាត់ត្រូវមានយ៉ាងតិច ៦ តួអក្សរ។"],
  ["An account with this email already exists.", "អ៊ីមែលនេះត្រូវបានប្រើរួចហើយ។"],
  ["Email and password are required.", "សូមបំពេញអ៊ីមែល និងលេខសម្ងាត់។"],
  ["Invalid email or password.", "អ៊ីមែល ឬលេខសម្ងាត់មិនត្រឹមត្រូវទេ។"],
  ["User session is no longer valid.", "សម័យប្រើប្រាស់នេះផុតសុពលភាពហើយ។ សូមចូលម្តងទៀត។"],
  ["Authentication failed.", "ការផ្ទៀងផ្ទាត់មិនបានជោគជ័យទេ។ សូមព្យាយាមម្តងទៀត។"],
  ["Authentication token is required.", "សូមចូលគណនីជាមុនសិន។"],
  ["Logged out successfully.", "បានចេញពីគណនីដោយជោគជ័យ។"]
]);

export const getKhmerErrorMessage = (message) => {
  if (!message) {
    return "មានបញ្ហាមួយបានកើតឡើង។ សូមព្យាយាមម្តងទៀត។";
  }

  return ERROR_MESSAGE_MAP.get(message) || message;
};
