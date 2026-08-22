# Hosting Slip on Unraid Community Applications

Complete guide for packaging, publishing, testing, and submitting **Slip** as an Unraid Community Applications (CA) app.

---

## 1. What you are actually publishing

Unraid Community Applications does **not** host the Slip application itself.

The recommended architecture is:

```text
Slip source code
      │
      ▼
GitHub repository
      │
      ├── Dockerfile
      │
      ▼
GitHub Actions
      │
      ▼
GitHub Container Registry (GHCR)
      │
      │  ghcr.io/YOUR_USERNAME/slip
      ▼
Unraid Docker Template
      │
      ▼
Community Applications
      │
      ▼
Unraid user clicks "Install"
```

You therefore need two main pieces:

1. A **Docker image** containing Slip.
2. An **Unraid Docker template** describing how Unraid should install/configure Slip.

---

# 2. Recommended repository structure

I recommend keeping the Slip application and Unraid packaging separate.

### Repository 1 — Slip

```text
github.com/YOUR_USERNAME/slip
```

Example:

```text
slip/
├── Dockerfile
├── src/
├── package.json
└── ...
```

### Repository 2 — Unraid package

```text
github.com/YOUR_USERNAME/unraid-slip
```

Recommended structure:

```text
unraid-slip/
├── ca_profile.xml
├── LICENSE
├── icon.png
└── templates/
    └── slip.xml
```

This keeps Unraid-specific configuration separate from Slip itself.

---

# 3. Publish the Slip Docker image

If Slip is already Dockerized, GitHub Container Registry (GHCR) is a convenient option.

Your image can be:

```text
ghcr.io/YOUR_GITHUB_USERNAME/slip:latest
```

For releases, also publish versioned tags:

```text
ghcr.io/YOUR_GITHUB_USERNAME/slip:1.0.0
```

Recommended versioning:

```text
1.0.0
1.1.0
1.1.1
```

Using semantic versioning makes upgrades easier to manage.

---

# 4. GitHub Actions workflow for GHCR

If Slip does not already have a Docker publishing workflow, create:

```text
.github/workflows/docker.yml
```

Example:

```yaml
name: Build and Publish Docker Image

on:
  push:
    branches:
      - main
    tags:
      - "v*.*.*"
  workflow_dispatch:

permissions:
  contents: read
  packages: write

jobs:
  docker:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Set up Buildx
        uses: docker/setup-buildx-action@v3

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/${{ github.repository_owner }}/slip
          tags: |
            type=raw,value=latest,enable={{is_default_branch}}
            type=ref,event=tag
            type=sha

      - name: Build and push
        uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
```

This will:

1. Check out Slip.
2. Log into GHCR.
3. Build the Docker image.
4. Tag it.
5. Push it to GHCR.

---

# 5. Create the Unraid Docker template

The Unraid Docker template tells Unraid:

- Which Docker image to use
- Which port to expose
- Which directories to persist
- Which environment variables to show
- Which WebUI to open
- Where the project/support pages are
- Which icon to display

Create:

```text
templates/slip.xml
```

Example:

```xml
<Container version="2">

  <Name>Slip</Name>

  <Repository>ghcr.io/YOUR_GITHUB_USERNAME/slip:latest</Repository>
  <Registry>https://ghcr.io/YOUR_GITHUB_USERNAME/slip</Registry>

  <Network>bridge</Network>
  <Privileged>false</Privileged>
  <Shell>bash</Shell>

  <Icon>https://raw.githubusercontent.com/YOUR_GITHUB_USERNAME/unraid-slip/main/icon.png</Icon>

  <WebUI>http://[IP]:[PORT:3000]</WebUI>

  <Overview>
    Slip is a self-hosted application.
  </Overview>

  <Project>https://github.com/YOUR_GITHUB_USERNAME/slip</Project>
  <Support>https://github.com/YOUR_GITHUB_USERNAME/slip/issues</Support>

  <Category>Tools:System</Category>
  <ExtraSearchTerms>slip self hosted</ExtraSearchTerms>

  <TemplateURL>
    https://raw.githubusercontent.com/YOUR_GITHUB_USERNAME/unraid-slip/main/templates/slip.xml
  </TemplateURL>

  <Date>2026-08-22</Date>

  <Changes>
    Initial release
  </Changes>

  <Config
    Name="WebUI Port"
    Target="3000"
    Default="3000"
    Mode="tcp"
    Description="Port used by the Slip web interface."
    Type="Port"
    Display="always"
    Required="true"
    Mask="false">
  </Config>

  <Config
    Name="Data"
    Target="/data"
    Default="/mnt/user/appdata/slip"
    Mode="rw"
    Description="Persistent application data."
    Type="Path"
    Display="always"
    Required="true"
    Mask="false">
  </Config>

</Container>
```

## Important

The above is an **example**.

You must change:

```text
3000
/data
```

to whatever Slip actually uses.

The final template should match the actual Slip Docker image.

---

# 6. Environment variables

If Slip requires environment variables, expose them through the Unraid template.

For example:

```xml
<Config
  Name="DATABASE_URL"
  Target="DATABASE_URL"
  Default=""
  Description="Database connection string."
  Type="Variable"
  Display="always"
  Required="true"
  Mask="false">
</Config>
```

For secrets:

```xml
<Config
  Name="SECRET_KEY"
  Target="SECRET_KEY"
  Default=""
  Description="Application secret."
  Type="Variable"
  Display="always"
  Required="true"
  Mask="true">
</Config>
```

Never put real credentials into:

- GitHub
- `slip.xml`
- `ca_profile.xml`
- Dockerfiles
- screenshots
- public documentation

---

# 7. Persistent storage

Anything Slip needs to retain after a container restart/recreation should be mapped to persistent storage.

Typical Unraid mapping:

```text
Host:
 /mnt/user/appdata/slip

Container:
 /data
```

Template:

```xml
<Config
  Name="Data"
  Target="/data"
  Default="/mnt/user/appdata/slip"
  Mode="rw"
  Description="Persistent application data."
  Type="Path"
  Display="always"
  Required="true"
  Mask="false">
</Config>
```

If Slip has multiple persistent directories, expose each one separately.

For example:

```text
/mnt/user/appdata/slip/config
        ↓
/config

/mnt/user/appdata/slip/data
        ↓
/data
```

Do not rely on the container filesystem for important data.

---

# 8. WebUI configuration

If Slip listens on container port `3000`:

```xml
<WebUI>http://[IP]:[PORT:3000]</WebUI>
```

The user can then choose a host port in Unraid.

For example:

```text
Unraid host:

192.168.1.50:8080

        ↓

Container:

3000
```

Unraid substitutes the configured port through:

```text
[PORT:3000]
```

---

# 9. Create `ca_profile.xml`

The Community Applications repository needs repository metadata.

Create:

```text
ca_profile.xml
```

Use the **current official Unraid CA starter repository and submission documentation** as the authoritative source for the exact schema.

Do not copy an old `ca_profile.xml` from an unrelated project because CA requirements can change.

The profile should identify your repository and its owner and follow the current CA format.

---

# 10. Add an icon

Add an icon to the Unraid repository:

```text
icon.png
```

For example:

```text
unraid-slip/
├── ca_profile.xml
├── LICENSE
├── icon.png
└── templates/
    └── slip.xml
```

The template can reference the raw GitHub URL:

```xml
<Icon>
https://raw.githubusercontent.com/YOUR_GITHUB_USERNAME/unraid-slip/main/icon.png
</Icon>
```

Make sure the image is publicly accessible.

---

# 11. License

Include an OSI-approved open-source license appropriate to the project and compatible with the current Community Applications requirements.

For example:

```text
LICENSE
```

Do not assume that an old CA submission guide is still correct. Verify the current requirements before submission.

---

# 12. Test the template locally on Unraid

Do **not** submit immediately.

First test the template directly on your Unraid server.

User Docker templates are stored under:

```text
/boot/config/plugins/dockerMan/templates-user/
```

Place the template there:

```text
/boot/config/plugins/dockerMan/templates-user/slip.xml
```

Then open the Unraid Docker interface and test the template.

---

# 13. Test the complete lifecycle

Before submitting Slip to Community Applications, test all of these:

- Fresh installation
- Container startup
- WebUI
- Port mapping
- Environment variables
- Persistent storage
- Container restart
- Container deletion/recreation
- Unraid reboot
- Docker service restart
- Application upgrade
- Image update
- Database connectivity, if applicable
- File uploads/downloads, if applicable
- Logs
- Permissions
- Authentication
- Network access

Most importantly, verify:

```text
Install
  ↓
Configure
  ↓
Run
  ↓
Create data
  ↓
Restart container
  ↓
Data still exists
```

Then test:

```text
Delete container
  ↓
Reinstall
  ↓
Data still exists
```

---

# 14. Submit to Community Applications

Once the template works correctly:

1. Publish the Unraid template repository on GitHub.
2. Make sure the repository is publicly accessible.
3. Make sure the Docker image can be pulled.
4. Make sure the template references the correct URLs.
5. Make sure `ca_profile.xml` follows the current format.
6. Make sure the required license is present.
7. Submit the repository through the current Unraid Community Applications submission portal.

Current portal:

```text
https://ca.unraid.net/
```

Use the current Unraid documentation and official starter repository as the source of truth for the submission process and validation rules.

---

# 15. What happens after submission

After submission, the repository/template goes through the Community Applications validation/review process.

Once accepted, Unraid users should be able to:

```text
Unraid
  ↓
Apps
  ↓
Search "Slip"
  ↓
Slip
  ↓
Install
```

The user then gets the normal Unraid Docker configuration interface.

---

# 16. Release strategy

For production, publish both versioned and latest tags.

Example:

```text
ghcr.io/YOUR_USERNAME/slip:1.0.0
ghcr.io/YOUR_USERNAME/slip:latest
```

Then:

```text
1.0.0
  ↓
1.1.0
  ↓
1.1.1
  ↓
1.2.0
```

Use semantic versioning.

A useful distinction is:

```text
MAJOR.MINOR.PATCH

1.0.0
│ │ │
│ │ └── bug fixes
│ └──── backwards-compatible features
└────── breaking changes
```

---

# 17. Using `latest` vs versioned images

## Option A — `latest`

Template:

```xml
<Repository>
  ghcr.io/YOUR_USERNAME/slip:latest
</Repository>
```

Advantages:

- Easy updates
- Users get new versions automatically when updating the image
- Less template maintenance

Disadvantages:

- A bad release can affect users immediately
- Less deterministic

## Option B — Versioned

Template:

```xml
<Repository>
  ghcr.io/YOUR_USERNAME/slip:1.0.0
</Repository>
```

Advantages:

- Deterministic
- Safer upgrades
- Easier rollback

Disadvantages:

- You need to update the template for releases

For a mature application, a controlled versioning strategy is preferable.

---

# 18. Security checklist

Before publishing:

- [ ] Never commit API keys.
- [ ] Never commit passwords.
- [ ] Never commit private certificates.
- [ ] Never commit database credentials.
- [ ] Run the container as a non-root user where possible.
- [ ] Avoid privileged mode unless required.
- [ ] Expose only required ports.
- [ ] Persist only required directories.
- [ ] Document required network access.
- [ ] Test upgrades.
- [ ] Test data migration.
- [ ] Test container recreation.
- [ ] Test Unraid reboot.
- [ ] Review Docker image dependencies.

---

# 19. Final repository

Your Unraid repository should eventually look approximately like:

```text
unraid-slip/
│
├── ca_profile.xml
│
├── LICENSE
│
├── icon.png
│
└── templates/
    │
    └── slip.xml
```

Your Slip repository should contain something like:

```text
slip/
│
├── Dockerfile
│
├── .github/
│   └── workflows/
│       └── docker.yml
│
├── src/
│
├── package.json
│
└── ...
```

---

# 20. Final checklist

## Slip Docker image

- [ ] Dockerfile works
- [ ] Docker image builds
- [ ] Image runs locally
- [ ] Image runs on Unraid
- [ ] Image is published to GHCR
- [ ] Image can be pulled without private credentials

## Unraid template

- [ ] `slip.xml` exists
- [ ] Correct image repository
- [ ] Correct container port
- [ ] Correct host port mapping
- [ ] Correct persistent paths
- [ ] Correct environment variables
- [ ] WebUI works
- [ ] Icon works
- [ ] Project URL works
- [ ] Support URL works
- [ ] Template URL works

## CA repository

- [ ] `ca_profile.xml`
- [ ] `LICENSE`
- [ ] `icon.png`
- [ ] `templates/slip.xml`
- [ ] Public GitHub repository
- [ ] Current CA requirements satisfied

## Testing

- [ ] Fresh installation
- [ ] Start/stop
- [ ] Restart
- [ ] Unraid reboot
- [ ] Persistent data
- [ ] Delete/reinstall
- [ ] Upgrade
- [ ] Logs
- [ ] Permissions
- [ ] Networking

## Submission

- [ ] Repository published
- [ ] Template tested
- [ ] Docker image tested
- [ ] CA submission completed
- [ ] Validation/review passed

---

# 21. Important: customize this for Slip

The XML examples in this guide are **templates**, not necessarily the final Slip configuration.

The final production template must be based on Slip's actual:

- Dockerfile
- exposed ports
- startup command
- persistent directories
- environment variables
- database requirements
- user/group IDs
- health checks
- network requirements
- device requirements
- authentication configuration
- upgrade/migration behavior

Do not submit the example XML unchanged.

---

# 22. Best next step

Provide the **GitHub repository for Slip**, or its:

```text
Dockerfile
```

and/or:

```text
docker-compose.yml
```

From that, the generic guide can be converted into the actual production package:

```text
unraid-slip/
├── ca_profile.xml
├── LICENSE
├── icon.png
└── templates/
    └── slip.xml
```

along with the exact:

```text
.github/workflows/docker.yml
```

for GHCR publishing and the final Community Applications submission configuration.
