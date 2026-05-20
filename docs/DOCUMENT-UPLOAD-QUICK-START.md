# Client Document Upload - Quick Start Guide

## 🚀 How to Use

### Uploading Documents

1. **Navigate to Project**
   - Open any Darwin Finishes design project
   - Click the "Documents" tab

2. **Select Category**
   - Choose the document type:
     - 📸 Reference Images (mood boards, inspiration)
     - 📐 CAD Drawings (DWG, DXF files)
     - 📄 PDF Plans (technical drawings)
     - 📋 Design Briefs (project specifications)
     - 📎 Other Documents

3. **Upload Files**
   - Drag and drop files into the upload zone
   - OR click to browse and select files
   - Multiple files supported

4. **Wait for AI Analysis** (automatic for images & briefs)
   - Upload progress will show
   - AI analysis starts automatically
   - Status updates in real-time

5. **Review AI Results**
   - Click "View AI Analysis" to see details
   - Review extracted items, materials, style
   - Click "Apply to Project" to create design items

---

## 🤖 AI Analysis

### What Gets Analyzed?

**Reference Images** → Image Analysis AI
- Identifies furniture items
- Analyzes style (modern, traditional, etc.)
- Recommends materials and finishes
- Estimates manufacturing complexity

**Design Briefs (PDF)** → Project Scoping AI
- Extracts design items from text
- Detects multipliers ("32 rooms, each with...")
- Generates deliverable list
- Identifies ambiguities

**CAD Drawings & PDF Plans** → No AI
- Stored for reference only
- No automatic analysis

---

## 📏 File Requirements

| Category | File Types | Max Size |
|----------|-----------|----------|
| Reference Images | JPEG, PNG, WebP | 20 MB |
| CAD Drawings | DWG, DXF | 100 MB |
| PDF Plans | PDF | 50 MB |
| Design Briefs | PDF | 10 MB |
| Other | Any | 50 MB |

---

## ✅ Testing AI Tools

### Verify All AI Tools Are Working

1. **Navigate to AI Tools**
   - Go to `/finishes/design/ai-tools`
   - Or use the navigation menu

2. **Run Tests**
   - Select "AI Testing & Verification"
   - Click "Run All Tests"
   - Wait for results (30-60 seconds)

3. **Review Results**
   - ✅ Green = Passing
   - ❌ Red = Failed (retry or contact support)

---

## 💡 Tips & Best Practices

### For Best AI Results

**Images:**
- Use high-quality reference images (800x600 minimum)
- Clear, well-lit photos work best
- Multiple angles of same item help
- Include material close-ups

**Design Briefs:**
- Use structured format with bullet points
- Specify quantities clearly ("32 rooms" not "many rooms")
- Include dimensions when known
- List materials explicitly

**General:**
- Upload documents early in project lifecycle
- Review AI confidence scores (>70% is good)
- Apply AI suggestions as starting point, then refine
- CAD files are for reference - no AI analysis

---

## 🐛 Common Issues

### Upload Fails
- **Check file size** - Reduce if too large
- **Check file type** - Must match category
- **Try again** - Network issues are temporary

### AI Not Running
- **Check category** - Only images & briefs get AI
- **Wait** - Analysis can take 5-10 seconds
- **Retry** - Click "Retry Analysis" if failed

### AI Results Inaccurate
- **Check confidence score** - Low score (<50%) = less reliable
- **Review source** - Better source = better results
- **Edit before applying** - AI is a starting point

---

## 🔗 Quick Links

- **AI Tools Page**: `/finishes/design/ai-tools`
- **Documentation**: See full deployment guide
- **Support**: Check Firebase logs for errors

---

## 📱 Access the Feature

**Route**: Any project → Documents tab

**Direct URLs**:
- AI Tools: `https://your-domain.com/finishes/design/ai-tools`
- Project Documents: `https://your-domain.com/finishes/design/project/{projectId}` → Documents tab

---

**Last Updated**: January 18, 2026
