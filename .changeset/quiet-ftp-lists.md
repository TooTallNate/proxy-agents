---
'get-uri': patch
---

Bumps basic-ftp dependency to v6.2.3 to fix GHSA-c475-qrg2-pj4r (CPU denial of service in the directory-listing parser). basic-ftp v6 no longer follows a PASV response that points at a different host than the control connection.
