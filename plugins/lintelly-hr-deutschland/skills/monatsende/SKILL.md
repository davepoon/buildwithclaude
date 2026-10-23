---
name: monatsende
description: Monatsende in der Lohnabrechnung einer kleinen Firma in Deutschland. Nutzen, wenn ein Gründer den Lohn-Input für das Lohnbüro vorbereitet oder wissen will, was zum Monatsende fällig ist (Beiträge, Lohnsteuer-Anmeldung, Arbeitszeit bei Minijobs, Mindestlohn).
---

# Monatsende

1. Ruf `ablauf` mit `art: monatsende_lohn` und dem Monat auf. Gib die Termine als Liste aus.
2. Frag nach Änderungen im Monat: neue Leute, Austritte, Krankheit, Urlaub, Stunden, Einmalzahlungen. Nur Zahlen und Daten.
3. Prüf bei Minijobs `minijob` (Stundengrenze) und bei Lohnänderungen `mindestlohn_check`.
4. Fasse am Ende den Lohn-Input als kurze Liste fürs Lohnbüro zusammen, ohne Namen in den Werkzeugaufrufen.
