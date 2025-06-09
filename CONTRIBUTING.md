# Contributing to Strapi Audit Logs Plugin

Thank you for your interest in contributing to the Strapi Audit Logs Plugin!

## 🚀 Getting Started

### Prerequisites

- Node.js 18.x or 20.x
- npm or yarn
- A Strapi v4 project for testing

### Development Setup

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/dimitrisganotis/strapi-plugin-audit-logs.git
   cd strapi-plugin-audit-logs
   ```

3. **Install dependencies**:
   ```bash
   npm install
   ```

4. **Link to a Strapi project** for testing:
   ```bash
   # In your Strapi project
   npm install /path/to/strapi-plugin-audit-logs
   ```

5. **Configure the plugin** in your test Strapi project's `config/plugins.js`

## 🛠️ Development Guidelines

### Code Style

- Follow existing code patterns and conventions
- Use meaningful variable and function names
- Add comments for complex logic
- Keep functions small and focused

### Testing

- Test your changes in a real Strapi v4 project
- Verify the admin interface works correctly
- Test different database configurations if possible
- Ensure log cleanup functionality works

### Commit Messages

Use clear and descriptive commit messages:
- `feat: add new feature`
- `fix: resolve issue with...`
- `docs: update README`
- `refactor: improve code structure`

## 📝 Pull Request Process

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** and test thoroughly

3. **Update documentation** if needed (README, CHANGELOG)

4. **Commit your changes**:
   ```bash
   git add .
   git commit -m "feat: your descriptive message"
   ```

5. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Create a Pull Request** on GitHub with:
   - Clear description of changes
   - Screenshots if UI changes are involved
   - Reference to any related issues

## 🐛 Bug Reports

When reporting bugs, please include:

- Strapi version
- Node.js version
- Database type and version
- Plugin configuration
- Steps to reproduce
- Expected vs actual behavior
- Error messages or logs

## 💡 Feature Requests

For feature requests, please:

- Check if the feature already exists
- Describe the use case clearly
- Explain why it would be valuable
- Consider implementation complexity

## 📋 Areas for Contribution

We welcome contributions in these areas:

- **Bug fixes** - Help resolve reported issues
- **Performance improvements** - Optimize logging performance
- **Documentation** - Improve guides and examples
- **Testing** - Add test coverage
- **Features** - Implement new functionality
- **Translations** - Add support for more languages

## 🔍 Code Review Process

- All submissions require review
- Maintainers will provide feedback
- Address review comments promptly
- Be patient - reviews take time

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

## 🤝 Community

- Be respectful and inclusive
- Help others learn and grow
- Share knowledge and best practices
- Follow the [Strapi Community Guidelines](https://strapi.io/community)

## ❓ Questions?

If you have questions about contributing:

1. Check existing issues and discussions
2. Create a new issue with the "question" label
3. Join the Strapi Discord community

Thank you for contributing! 🎉
