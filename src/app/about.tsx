import { ScrollView, Text, StyleSheet } from 'react-native';

export default function AboutScreen() {
    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <Text style={styles.heading}>About Nudge</Text>
            <Text style={styles.paragraph}>
                Nudge is a personal tool for tracking credit card debt and
                exploring payoff strategies.
            </Text>

            <Text style={styles.sectionTitle}>General information only</Text>
            <Text style={styles.paragraph}>
                Everything in this app - payoff calculations, credit utilization
                estimates, and score-range projections - is based on information you
                enter yourself and on generally published, publicly available
                research about how credit scoring and debt payoff work. It is not
                personalized financial, credit, or legal advice.
            </Text>

            <Text style={styles.sectionTitle}>Not a substitute for professional advice</Text>
            <Text style={styles.paragraph}>
                This app is not a financial advisor, credit counselor, credit
                bureau, or attorney. For decisions about your specific financial
                situation, consult a qualified professional.
            </Text>

            <Text style={styles.sectionTitle}>Estimates only, not guarantees</Text>
            <Text style={styles.paragraph}>
                Score-range and payoff projections are rough estimates based on
                commonly-cited patterns. Actual results depend on your complete
                credit history, payment record, account age, and many other factors
                this app doesn&apos;t track. Nothing in this app guarantees any
                particular outcome.
            </Text>

            <Text style={styles.sectionTitle}>Your data stays on your device</Text>
            <Text style={styles.paragraph}>
                All information you enter is stored locally on your device and is
                not sent to any server or third party.
            </Text>

            <Text style={styles.sectionTitle}>Your decisions are your own</Text>
            <Text style={styles.paragraph}>
                You are solely responsible for any financial decisions you make
                using this app.
            </Text>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { padding: 20, paddingBottom: 40 },
    heading: { fontSize: 20, fontWeight: '600', marginBottom: 16 },
    sectionTitle: { fontSize: 14, fontWeight: '600', marginTop: 18, marginBottom: 6 },
    paragraph: { fontSize: 14, color: '#444', lineHeight: 21 },
});