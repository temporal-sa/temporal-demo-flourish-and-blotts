# MailHog — the demo's fake SMTP server + web inbox for customer-HITL emails.
#
# The tmprl-demo.cloud platform requires every component to reference a build in
# this repo (there are no bare prebuilt-image components). This thin wrapper lets
# CodeBuild build MailHog and the operator deploy it as a normal component with a
# stable Service (SMTP on 1025, web UI on 8025).
#
# Local docker-compose still pulls mailhog/mailhog directly; this Dockerfile only
# exists for the platform build.
FROM mailhog/mailhog:latest
