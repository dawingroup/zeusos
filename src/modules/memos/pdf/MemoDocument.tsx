/**
 * The memo PDF — A4 letterhead memorandum. Page 1: letterhead, the title
 * MEMORANDUM, the class line, the TO/THROUGH/CC/FROM/DATE/REF/SUBJECT grid,
 * then the sections. The decision block (outcome, conditions verbatim, typed
 * signature) follows the body; then clearance, references and the
 * distribution table. Every page carries the memo reference in the footer.
 */
import * as React from 'react';
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { MemoDocData, MemoDocSection } from './memoDocData';
import type { ProseBlock } from '../utils/memoProse';

const INK = '#0A1F4A';
const BODY = '#1f2937';
const MUTED = '#6b7280';
const RULE = '#d1d5db';

const s = StyleSheet.create({
  page: { paddingTop: 48, paddingBottom: 60, paddingHorizontal: 54, fontFamily: 'Helvetica', fontSize: 10, color: BODY },
  letterhead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', borderBottomWidth: 1.5, borderBottomColor: INK, paddingBottom: 8 },
  wordmark: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: INK, letterSpacing: 1 },
  groupLine: { fontSize: 8, color: MUTED, marginTop: 2 },
  letterheadRef: { fontSize: 8, color: MUTED },
  title: { marginTop: 26, fontSize: 20, fontFamily: 'Helvetica-Bold', color: INK, letterSpacing: 2 },
  chipLine: { marginTop: 3, fontSize: 7.5, color: MUTED, textTransform: 'uppercase', letterSpacing: 1 },
  draftLine: { marginTop: 5, fontSize: 8.5, color: '#b45309' },
  headerGrid: { marginTop: 16, borderTopWidth: 1, borderTopColor: INK, paddingTop: 6 },
  headerRow: { flexDirection: 'row', paddingVertical: 2 },
  headerLabel: { width: 64, fontSize: 7.5, color: MUTED, textTransform: 'uppercase', letterSpacing: 1, paddingTop: 1.5 },
  headerValue: { flex: 1, fontSize: 10, color: INK, lineHeight: 1.4 },
  headerSubject: { flex: 1, fontSize: 10, color: INK, fontFamily: 'Helvetica-Bold', lineHeight: 1.4 },
  headerRule: { borderBottomWidth: 1, borderBottomColor: INK, marginTop: 6, marginBottom: 14 },
  sectionHeading: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: INK, textTransform: 'uppercase', letterSpacing: 1, marginTop: 12, marginBottom: 4 },
  subHeading: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: INK, marginTop: 6, marginBottom: 2 },
  para: { fontSize: 10, color: BODY, lineHeight: 1.55, marginBottom: 5 },
  listRow: { flexDirection: 'row', marginBottom: 2.5, paddingLeft: 6 },
  listGlyph: { width: 14, fontSize: 10, lineHeight: 1.55 },
  listText: { flex: 1, fontSize: 10, lineHeight: 1.55 },
  decision: { marginTop: 18, padding: 10, borderWidth: 1, borderColor: RULE },
  decisionOutcome: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: INK, letterSpacing: 1, marginBottom: 5 },
  decisionText: { fontSize: 10, lineHeight: 1.5, marginBottom: 3 },
  signRow: { flexDirection: 'row', gap: 28, marginTop: 14 },
  signBox: { width: 200 },
  signScript: { fontFamily: 'Times-Italic', fontSize: 14, color: INK, paddingBottom: 2 },
  signRule: { borderTopWidth: 1, borderTopColor: INK, paddingTop: 3 },
  signCaption: { fontSize: 7, color: MUTED, textTransform: 'uppercase', letterSpacing: 1 },
  signName: { fontSize: 9.5, color: INK, marginTop: 2 },
  signMeta: { fontSize: 8, color: MUTED },
  refRow: { flexDirection: 'row', marginBottom: 2 },
  refLabel: { width: 56, fontSize: 8, color: MUTED, textTransform: 'uppercase' },
  refText: { flex: 1, fontSize: 9, lineHeight: 1.4 },
  distHead: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: INK, paddingBottom: 2, marginTop: 3 },
  distHeadCell: { fontSize: 7.5, color: MUTED, textTransform: 'uppercase', letterSpacing: 1 },
  distRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: RULE, paddingVertical: 3 },
  distCell: { fontSize: 9 },
  footer: { position: 'absolute', bottom: 22, left: 54, right: 54, flexDirection: 'row', justifyContent: 'space-between', paddingTop: 6, borderTopWidth: 0.5, borderTopColor: RULE },
  footerText: { fontSize: 7.5, color: MUTED },
  hash: { fontSize: 6.5, color: MUTED, marginTop: 10 },
});

function Blocks({ blocks }: { blocks: ProseBlock[] }) {
  return (
    <>
      {blocks.map((b, i) => {
        if (b.kind === 'sub') return <Text key={i} style={s.subHeading}>{b.text}</Text>;
        if (b.kind === 'list') {
          return (
            <View key={i} style={{ marginBottom: 4 }}>
              {b.items.map((item, j) => (
                <View key={j} style={s.listRow}>
                  <Text style={s.listGlyph}>{b.ordered ? `${j + 1}.` : '•'}</Text>
                  <Text style={s.listText}>{item}</Text>
                </View>
              ))}
            </View>
          );
        }
        return <Text key={i} style={s.para}>{b.text}</Text>;
      })}
    </>
  );
}

function Section({ section }: { section: MemoDocSection }) {
  const [first, ...rest] = section.blocks;
  return (
    <View>
      <View wrap={false}>
        <Text style={s.sectionHeading}>{section.heading}</Text>
        {first ? <Blocks blocks={[first]} /> : null}
      </View>
      {rest.length ? <Blocks blocks={rest} /> : null}
    </View>
  );
}

function HeaderRow({ label, value, subject }: { label: string; value: string; subject?: boolean }) {
  return (
    <View style={s.headerRow}>
      <Text style={s.headerLabel}>{label}</Text>
      <Text style={subject ? s.headerSubject : s.headerValue}>{value}</Text>
    </View>
  );
}

export function MemoDocument({ data }: { data: MemoDocData }): React.ReactElement {
  const ref = data.draft ? `${data.memoNumber} · DRAFT` : `${data.memoNumber}${data.versionLabel ? ` · ${data.versionLabel}` : ''}`;
  return (
    <Document title={data.title} author={data.issuer.name}>
      <Page size="A4" style={s.page}>
        <View style={s.letterhead}>
          <View>
            <Text style={s.wordmark}>{data.issuer.name.toUpperCase()}</Text>
            {data.issuer.groupLine ? <Text style={s.groupLine}>{data.issuer.groupLine}</Text> : null}
          </View>
          <Text style={s.letterheadRef}>{ref}</Text>
        </View>

        <Text style={s.title}>MEMORANDUM</Text>
        <Text style={s.chipLine}>{data.classLine}</Text>
        {data.draft ? <Text style={s.draftLine}>DRAFT — not issued. Content may still change.</Text> : null}

        <View style={s.headerGrid}>
          <HeaderRow label="To" value={data.header.to} />
          {data.header.through !== '—' ? <HeaderRow label="Through" value={data.header.through} /> : null}
          {data.header.cc !== '—' ? <HeaderRow label="Cc" value={data.header.cc} /> : null}
          <HeaderRow label="From" value={data.header.from} />
          <HeaderRow label="Date" value={data.header.date} />
          <HeaderRow label="Ref" value={`${data.memoNumber}${data.header.externalRef ? `  ·  ${data.header.externalRef}` : ''}`} />
          <HeaderRow label="Subject" value={data.subject} subject />
        </View>
        <View style={s.headerRule} />

        {data.sections.map((section) => <Section key={section.key} section={section} />)}

        {data.decision ? (
          <View style={s.decision} wrap={false}>
            <Text style={s.decisionOutcome}>{data.decision.outcomeLabel}</Text>
            {data.decision.conditions.map((b, i) =>
              b.kind === 'list' ? (
                <View key={i}>
                  {b.items.map((item, j) => (
                    <View key={j} style={s.listRow}>
                      <Text style={s.listGlyph}>{b.ordered ? `${j + 1}.` : '•'}</Text>
                      <Text style={s.listText}>{item}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text key={i} style={s.decisionText}>{b.text}</Text>
              ),
            )}
            {data.decision.notes ? <Text style={s.decisionText}>{data.decision.notes}</Text> : null}
            <View style={s.signRow}>
              <View style={s.signBox}>
                <Text style={s.signScript}>{data.decision.signedNameTyped}</Text>
                <View style={s.signRule}><Text style={s.signCaption}>Signature (typed)</Text></View>
                <Text style={s.signName}>{data.decision.signedByName}</Text>
                <Text style={s.signMeta}>{data.decision.dateLabel}</Text>
              </View>
            </View>
          </View>
        ) : null}

        {data.clearance.length ? (
          <View wrap={false}>
            <Text style={s.sectionHeading}>Clearance</Text>
            <View style={s.signRow}>
              {data.clearance.map((name, i) => (
                <View key={i} style={s.signBox}>
                  <View style={s.signRule}><Text style={s.signCaption}>Concurrence</Text></View>
                  <Text style={s.signName}>{name}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {data.references.length || data.attachments.length ? (
          <View wrap={false}>
            <Text style={s.sectionHeading}>References &amp; attachments</Text>
            {data.references.map((r, i) => (
              <View key={`r-${i}`} style={s.refRow}><Text style={s.refLabel}>Ref ({String.fromCharCode(97 + i)})</Text><Text style={s.refText}>{r}</Text></View>
            ))}
            {data.attachments.map((a, i) => (
              <View key={`a-${i}`} style={s.refRow}><Text style={s.refLabel}>Encl. {i + 1}</Text><Text style={s.refText}>{a}</Text></View>
            ))}
          </View>
        ) : null}

        {data.distribution.length ? (
          <View wrap={false}>
            <Text style={s.sectionHeading}>Distribution</Text>
            <View style={s.distHead}>
              <Text style={[s.distHeadCell, { flex: 3 }]}>Recipient</Text>
              <Text style={[s.distHeadCell, { flex: 2 }]}>Role</Text>
              <Text style={[s.distHeadCell, { flex: 2 }]}>Acknowledged</Text>
            </View>
            {data.distribution.map((d, i) => (
              <View key={i} style={s.distRow}>
                <Text style={[s.distCell, { flex: 3 }]}>{d.name}</Text>
                <Text style={[s.distCell, { flex: 2 }]}>{d.role}</Text>
                <Text style={[s.distCell, { flex: 2 }]}>{d.acknowledged}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {data.contentHash ? <Text style={s.hash}>Content hash (SHA-256): {data.contentHash}</Text> : null}

        <View style={s.footer} fixed>
          <Text style={s.footerText}>{data.issuer.name}</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `${data.memoNumber}  ·  Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
