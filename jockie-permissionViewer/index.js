const Plugin = require('powercord/Plugin');

const {
  getModuleByDisplayName,
  getModule,
  React,
  constants

} = require('powercord/webpack');

const Permissions = Object.assign({}, constants.Permissions); // eslint-disable-line no-shadow

if (Permissions.SEND_TSS_MESSAGES) {
  Permissions.SEND_TTS_MESSAGES = Permissions.SEND_TSS_MESSAGES;

  delete Permissions.SEND_TSS_MESSAGES;
}

if (Permissions.MANAGE_GUILD) {
  Permissions.MANAGE_SERVER = Permissions.MANAGE_GUILD;

  delete Permissions.MANAGE_GUILD;
}

const { ContextMenu: { Submenu } } = require('powercord/components');

const { inject, uninject } = require('powercord/injector');

const { Messages } = getModule([ 'Messages' ]);

const { getMember } = getModule([ 'getMember' ]);
const { getGuild } = getModule([ 'getGuild' ]);

const { int2hex } = getModule([ 'int2hex' ]);

module.exports = class PermissionViewer extends Plugin {
  getPermissionsRaw (guildId, userId) {
    let permissions = 0;

    const guild = getGuild(guildId);
    const member = getMember(guildId, userId);

    if (guild && member) {
      if (guild.ownerId === userId) {
        permissions = Permissions.ADMINISTRATOR;
      } else {
        /* @everyone is not inlcuded in the member's roles */
        permissions |= guild.roles[guild.id].permissions;

        for (const roleId of member.roles) {
          permissions |= guild.roles[roleId].permissions;
        }
      }

      /* If they have administrator they have every permission */
      if ((permissions & Permissions.ADMINISTRATOR) === Permissions.ADMINISTRATOR) {
        return Object.values(Permissions).reduce((a, b) => a | b, 0);
      }
    }

    return permissions;
  }

  getPermissions (guildId, userId) {
    const raw = this.getPermissionsRaw(guildId, userId);

    const permissions = {
      raw,
      entries: []
    };

    for (const [ name, permission ] of Object.entries(Permissions)) {
      if ((raw & permission) === permission) {
        permissions.entries.push({
          key: name,
          readable: Messages[name],
          raw: permission
        });
      }
    }

    return permissions;
  }

  getRolesWithPermission (guildId, permissions, roles = null) {
    const withPermissions = [];
    const guild = getGuild(guildId);

    if (!roles) {
      roles = guild.roles; // eslint-disable-line prefer-destructuring
    }

    for (let role of roles) {
      if (typeof role === 'string') {
        role = guild.roles[role];
      }

      if (role) {
        if ((role.permissions & Permissions.ADMINISTRATOR) === Permissions.ADMINISTRATOR || (role.permissions & permissions) === permissions) {
          withPermissions.push(role);
        }
      }
    }

    return withPermissions;
  }

  createLabel (name, additional) {
    return Object.assign({
      type: 'button',
      name,
      onClick: () => {} // eslint-disable-line no-empty-function
    }, additional);
  }

  start () {
    const _this = this;

    const UserContextMenu = getModuleByDisplayName('UserContextMenu');
    inject('jockie-permissionViewer-user', UserContextMenu.prototype, 'render', function (args, res) { // eslint-disable-line func-names
      const { children } = res.props.children.props.children.props;
      const rolesIndex = children.findIndex(item => item.type.displayName === 'UserRolesGroup');

      const { guildId } = this.props;
      const userId = this.props.user.id;

      const member = getMember(guildId, userId);
      if (member) {
        const createPermissionItems = () => {
          const permissions = _this.getPermissions(guildId, userId);

          if (permissions.raw === 0) {
            return _this.createLabel('None');
          }

          const items = [];
          for (const permission of permissions.entries) {
            const roles = _this.getRolesWithPermission(guildId, permission.raw, member.roles.concat([ guildId ]));

            if (roles.length > 0) {
              items.push({
                type: 'submenu',
                name: permission.readable,
                getItems: () => roles.map(role => _this.createLabel(role.name, {
                  highlight: role.color ? int2hex(role.color) : null
                }))
              });
            } else {
              items.push(_this.createLabel(permission.readable));
            }
          }

          return items;
        };

        children.splice(rolesIndex + 1, 0, React.createElement(Submenu, {
          name: 'Permissions',
          getItems: createPermissionItems
        }));
      }

      return res;
    });
  }

  unload () {
    uninject('jockie-permissionViewer-user');
  }
};
